import { DOMAIN_URL } from "@/constants/environments"

export const getUserCredits = async (browserId: string) => {
  const response = await fetch(
    `${DOMAIN_URL}/api/v1/users/get-or-create?browser_id=${browserId}`,
    {
      headers: {
        "Content-Type": "application/json",

      },
    }
  )
  const data = await response.json()
  return data.credits
}   

export const createCheckoutSession = async (browserId: string, packageId: string) => {
  const response = await fetch(
    `${DOMAIN_URL}/api/v1/payments/create-session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        browser_id: browserId,
        package: packageId
      })
    }
  )
  const data = await response.json()
  return data.url
}