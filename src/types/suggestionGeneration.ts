export type UploadedDocument = {
	base64_content: string;
	file_type: string;
	name: string;
};

// ----------------------------------------------------------------------------------------

export type ExtractedJobPostingDetails = {
	job_title: string;
	company_name: string;
	job_description: string;
	responsibilities: string[];
	requirements: string[];
	location: string;
	other_additional_details: string;
};

export type JobPostingEvalRequestInputs = {
	jobPostingPageContent: string;
	browser_id: string;
};

export type JobPostingEvalResultResponse = {
	is_job_posting: boolean;
	extracted_job_posting_details: ExtractedJobPostingDetails;
};

// ----------------------------------------------------------------------------------------

export type ResumeSuggestionGenerationRequestInputs = {
	extracted_job_posting_details: ExtractedJobPostingDetails;
	resume_doc: UploadedDocument;
	browser_id: string;
};

export type ResumeSuggestion = {
	where: string;
	suggestion: string;
	reason: string;
};

export type ResumeSuggestionsResponse = {
	resume_suggestions: ResumeSuggestion[];
};

// ----------------------------------------------------------------------------------------

export type CoverLetterGenerationRequestInputs = {
	extracted_job_posting_details: ExtractedJobPostingDetails;
	resume_doc: UploadedDocument;
	supporting_docs?: UploadedDocument[];
	browser_id: string;
};

export type CoverLetterGenerationResponse = {
	job_title_name: string;
	company_name: string;
	applicant_name: string;
	cover_letter: string;
	location: string;
};

// ----------------------------------------------------------------------------------------

export type ApplicationQuestion = {
	id: string;
	question: string;
	additionalRequirements?: string;
	answer?: string;
	createdAt: string;
};

export type ApplicationQuestionGenerationRequestInputs = {
	extracted_job_posting_details: ExtractedJobPostingDetails;
	resume_doc: UploadedDocument;
	supporting_docs?: UploadedDocument[];
	additional_requirements?: string;
	question: string;
	browser_id: string;
};

export type ApplicationQuestionAnswerResponse = {
	question: string;
	answer: string;
};

// ----------------------------------------------------------------------------------------

export type FullSuggestionGeneration = {
	job_title_name: string;
	company_name: string;
	applicant_name: string;
	cover_letter: string;
	location: string;
	resume_suggestions: ResumeSuggestion[];
	extracted_job_posting_details: ExtractedJobPostingDetails;
};
