import {
	evaluateJobPostingPageRequest,
	generateCoverLetterRequest,
	generateResumeSuggestionRequest,
} from '@/api/suggestionGeneration';
import { TIER_ONE_USER_CREDIT_COUNT } from '@/constants/environments';
import type { FilesStorageState } from '@/types/fileManagement';
import { GenerationStage, type GenerationProgress } from '@/types/progressTracking';
import type { FullSuggestionGeneration } from '@/types/suggestionGeneration';
import { useStorage } from '@plasmohq/storage/hook';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

type PageExtractionResult = {
	success: boolean;
	pageContent?: string;
	url: string;
	errorMessage?: string;
};

export const extractPageContentFromActiveTab = async (): Promise<PageExtractionResult> => {
	// Query for the active tab in the current window
	const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
	const activeTab = tabs[0];

	if (!activeTab || !activeTab.id) {
		throw new Error('No active job page found');
	}

	// chrome.tabs.sendMessage specifically designed to send messages to content scripts in a specific tab
	const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'getPageContent' });
	if (response.success) {
		return response;
	} else {
		throw new Error(response.errorMessage);
	}
};

export const useSuggestionGenerationProcess = (storedFilesObj: FilesStorageState) => {
	const [currentTabId, setCurrentTabId] = useState<number | null>(null);
	const [usedSuggestionCredits, setUsedSuggestionCredits] = useState<number>(0);
	const [lastSuggestion, setLastSuggestion] = useState<FullSuggestionGeneration | null>(null);
	const [lastSuggestionAndCreditUsedLoadingErrMessage, setLastSuggestionAndCreditUsedLoadingErrMessage] = useState<
		string | null
	>(null);
	const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
	const [browserId] = useStorage("browserId")

	// Get the current tab ID when the hook initializes
	useEffect(() => {
		const getCurrentTabId = async () => {
			try {
				const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
				if (tabs[0]?.id) {
					setCurrentTabId(tabs[0].id);
				}
			} catch (err) {
				console.error('Error getting current tab ID:', err);
			}
		};
		getCurrentTabId();
	}, []);

	// Load tab-specific used credits count and last (latest) generation results
	useEffect(() => {
		const loadData = async () => {
			if (!currentTabId) return;

			try {
				const storageResult = await chrome.storage.local.get(['usedSuggestionCreditsCount', 'tabSuggestions']);

				setUsedSuggestionCredits(storageResult.usedSuggestionCreditsCount || 0);

				// Get existing tab-specific suggestion if available
				const tabSuggestions = storageResult.tabSuggestions || {};
				if (tabSuggestions[currentTabId]) {
					setLastSuggestion(tabSuggestions[currentTabId]);
				} else {
					setLastSuggestion(null);
				}
			} catch (err) {
				console.error('Error loading tab-specific last suggestion & credit count data:', err);
				setLastSuggestionAndCreditUsedLoadingErrMessage('Failed to load last suggestion and credit count data');
			}
		};

		loadData();
	}, [currentTabId]);

	useEffect(() => {
		const syncUsedCreditSuggestionCountChange = (
			changes: { [key: string]: chrome.storage.StorageChange },
			areaName: string,
		) => {
			// Only react to changes in local storage
			if (areaName !== 'local') return;

			// Update credit usage if it changed
			if (changes.usedSuggestionCreditsCount) {
				const newValue = changes.usedSuggestionCreditsCount.newValue;
				if (newValue !== undefined) {
					setUsedSuggestionCredits(newValue);
				}
			}
		};

		// This useEffect is to essentially Add the listener here,
		// this will centrally react to any changes in usedSuggestionCreditsCount handled in the background script
		chrome.storage.onChanged.addListener(syncUsedCreditSuggestionCountChange);

		// Clean up the listener when the component unmounts
		return () => {
			chrome.storage.onChanged.removeListener(syncUsedCreditSuggestionCountChange);
		};
	}, [currentTabId]);

	const handleGenerateSuggestionsProcess = async () => {
		if (!currentTabId) {
			throw new Error('No active tab found');
		}

		// Reset error message
		setLastSuggestionAndCreditUsedLoadingErrMessage(null);

		try {
			// STEP 1: Extract page content
			setGenerationProgress({
				stagePercentage: GenerationStage.ANALYZING_JOB_POSTING,
				message: 'Analyzing job posting content...',
			});

			const pageExtractedContent = await extractPageContentFromActiveTab();
			const jobPostingEvaluationResponseResult = await evaluateJobPostingPageRequest(
				pageExtractedContent.pageContent,
				browserId
			);

			// STEP 2: Generate resume suggestions
			setGenerationProgress({
				stagePercentage: GenerationStage.GENERATING_RESUME_SUGGESTIONS,
				message: 'Generating tailored resume suggestions...',
			});

			const resumeSuggestionsResponseResult = await generateResumeSuggestionRequest({
				extractedJobPostingDetails: jobPostingEvaluationResponseResult.extracted_job_posting_details,
				storedFilesObj,
				browserId
			});

			// STEP 3: Generate cover letter
			setGenerationProgress({
				stagePercentage: GenerationStage.CREATING_COVER_LETTER,
				message: 'Generating tailored cover letter...',
			});

			const coverLetterResponseResult = await generateCoverLetterRequest({
				extractedJobPostingDetails: jobPostingEvaluationResponseResult.extracted_job_posting_details,
				storedFilesObj,
				browserId
			});

			// STEP 4: Complete - combine all results into FullSuggestionGeneration
			setGenerationProgress({
				stagePercentage: GenerationStage.COMPLETED,
				message: 'Generation process complete!',
			});

			// Combine coverLetterResponseResult and resumeSuggestionsResponseResult into a single object
			// we will also "extracted_job_posting_details" from jobPostingEvaluationResponseResult to save them all together for now for convenience
			// this "extracted_job_posting_details" for application questions later
			const newSuggestionCombinedResults: FullSuggestionGeneration = {
				job_title_name: coverLetterResponseResult.job_title_name,
				company_name: coverLetterResponseResult.company_name,
				applicant_name: coverLetterResponseResult.applicant_name,
				cover_letter: coverLetterResponseResult.cover_letter,
				location: coverLetterResponseResult.location,
				resume_suggestions: resumeSuggestionsResponseResult.resume_suggestions,
				extracted_job_posting_details: jobPostingEvaluationResponseResult.extracted_job_posting_details,
			};

			// Increment credit usage via background script to prevent race conditions (same user on different tabs of job postings share the same credit count)
			// This is to ensure that the user's credit count is updated in the background script, which is the source of truth for the credit count
			await chrome.runtime.sendMessage({ action: 'incrementCredits' });

			// Store or update existing tab-specific suggestion
			const storageResult = await chrome.storage.local.get('tabSuggestions');
			const tabSuggestions = storageResult.tabSuggestions || {};
			tabSuggestions[currentTabId] = newSuggestionCombinedResults;
			await chrome.storage.local.set({ tabSuggestions });

			return newSuggestionCombinedResults;
		} catch (error) {
			// Reset progress on error
			setGenerationProgress(null);
			throw error; // Re-throw to be handled by the mutation
		}
	};

	const suggestionCreditUsagePercentage = Math.min(
		100,
		Math.round((usedSuggestionCredits / TIER_ONE_USER_CREDIT_COUNT) * 100),
	);

	const mutation = useMutation({
		mutationFn: handleGenerateSuggestionsProcess,
	});

	return {
		mutation,
		usedSuggestionCredits,
		lastSuggestionAndCreditUsedLoadingErrMessage,
		suggestionCreditUsagePercentage,
		lastSuggestion,
		currentTabId,
		generationProgress,
	};
};
