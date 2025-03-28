import React, { useEffect, useState } from "react"
import { Button } from "./ui/button"
import { Card } from "@/components/ui/card"
import { useStorage } from "@plasmohq/storage/hook"
import { generateBrowserId } from "@/utils/browser"
import { createCheckoutSession, getUserCredits } from "@/api/payment"

type CreditPackage = {
  credits: number
  price: number
}

const CREDIT_PACKAGES: Record<string, CreditPackage> = {
  "25": { credits: 25, price: 3.99 },
  "65": { credits: 65, price: 7.99 }
}

export function CreditManager() {
  const [credits, setCredits] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [browserId, setBrowserId, {isLoading}] = useStorage("browserId")

  useEffect(() => {
    if (!isLoading && !browserId) {
      setBrowserId(generateBrowserId())
    }
    fetchUserCredits()
  }, [browserId])

  const fetchUserCredits = async () => {
    if (!browserId) {
      return
    }
    try {

      const credits = await getUserCredits(browserId)
      setCredits(credits)
    } catch (error) {
      console.error("Error fetching credits:", error)
    }
  }

  const handlePurchase = async (package_id: string) => {
    try {
      setLoading(true)
      const url = await createCheckoutSession(browserId, package_id)
      
      // Open Stripe checkout in a new window
      window.open(url, "_blank")
    } catch (error) {
      console.error("Error creating checkout session:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-4 mb-4">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Purchase Credits</h3>
          <span className="text-sm font-bold">{credits}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(CREDIT_PACKAGES).map(([id, pkg]) => (
            <Button
              key={id}
              variant="outline"
              onClick={() => handlePurchase(id)}
              disabled={loading}
              className="flex flex-col p-4">
              <span className="text-md font-semibold">{pkg.credits} Credits</span>
            </Button>
          ))}
        </div>
      </div>
    </Card>
  )
} 