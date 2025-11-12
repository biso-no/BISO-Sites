"use server"
import { Client, type CreatePaymentRequest } from "@vippsmobilepay/sdk"
import { v4 as uuidv4 } from 'uuid'

const clientId = process.env.VIPPS_CLIENT_ID!
const clientSecret = process.env.VIPPS_CLIENT_SECRET!
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!
const merchantSerialNumber = process.env.VIPPS_MERCHANT_SERIAL_NUMBER!
const subscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY!
const testMode = process.env.VIPPS_TEST_MODE === 'true'


const vipps = Client({
    merchantSerialNumber: merchantSerialNumber,
    subscriptionKey: subscriptionKey,
    useTestMode: testMode,
    retryRequests: false,
});

export async function getVippsAccessToken() {
    
    if (!clientId || !clientSecret) {
        throw new Error("VIPPS_CLIENT_ID and VIPPS_CLIENT_SECRET are not set")
    }

    const accessToken = await vipps.auth.getToken(clientId, clientSecret)
    return accessToken
}

export async function createVippsCheckout({
    email,
    firstName,
    lastName,
    phoneNumber,
    orderId,
    amount,
    reference,
    paymentDescription,
}: {
    email: string,
    firstName: string,
    lastName: string,
    phoneNumber: string,
    orderId?: string,
    amount: number,
    reference: string,
    paymentDescription: string,
}) {
    const checkout = await vipps.checkout.create(clientId, clientSecret, {
        merchantInfo: {
            callbackUrl: `${baseUrl}/api/checkout/webhook`,
            returnUrl: `${baseUrl}/api/checkout/return${orderId ? `?orderId=${orderId}` : ''}`,
            callbackAuthorizationToken: uuidv4(),
        },
        type: "PAYMENT",
        transaction: {
            amount: {
                currency: "NOK",
                value: amount,
            },
            reference: reference,
            paymentDescription: paymentDescription, 
        },
        configuration: {
            customerInteraction: "CUSTOMER_NOT_PRESENT",
            userFlow: "WEB_REDIRECT",
            showOrderSummary: true,
        },
        prefillCustomer: {
            email: email,
            firstName: firstName,
            lastName: lastName,
            phoneNumber: phoneNumber,
        }
    })
    return checkout
}

export async function getVippsCheckout(reference: string) {
    const checkout = await vipps.checkout.info(clientId, clientSecret, reference)
    return checkout
}

