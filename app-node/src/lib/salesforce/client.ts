/**
 * SalesforceProxyClient - Type-safe HTTP client for communicating with the
 * Rails Salesforce proxy. Every request includes the internal API key header
 * and a 30-second timeout via AbortSignal.
 *
 * This module does NOT implement retry logic (handled separately in Task 3.2).
 */

import { env } from "../../config/env"
import {
  createGenericProxyError,
  isProxyAuthRejection,
  logProxyAuthFailure,
} from "../security/proxy-logger"
import type {
  AmiLevel,
  AmiParams,
  Application,
  ApplicationData,
  Contact,
  ContactUpdate,
  EligibilityData,
  EligibilityFilters,
  LendingInstitution,
  Listing,
  ListingsParams,
  LotteryBucket,
  LotteryRanking,
  Preference,
  Unit,
  ValidationResult,
} from "./types"

const REQUEST_TIMEOUT_MS = 30_000

/**
 * Builds the default headers for every request to the Rails proxy.
 */
function defaultHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Internal-Api-Key": env.INTERNAL_API_KEY,
  }
}

/**
 * Core fetch wrapper that applies timeout and default headers.
 */
async function proxyFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${env.RAILS_API_BASE_URL}${path}`

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders(),
      ...(options.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    // If the Rails proxy rejected our API key, log the auth failure
    // and throw a generic error that doesn't reveal proxy infrastructure
    if (isProxyAuthRejection(response.status)) {
      logProxyAuthFailure({
        endpoint: path,
        statusCode: response.status,
        method: options.method ?? "GET",
      })
      throw createGenericProxyError()
    }

    const error = new ProxyClientError(
      `Salesforce proxy returned ${response.status}: ${response.statusText}`,
      response.status,
      await response.text().catch(() => "")
    )
    throw error
  }

  // Handle 204 No Content (e.g., DELETE responses)
  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

/**
 * Builds a query string from params, filtering out undefined/null values.
 */
function buildQuery(params: Record<string, unknown> | object): string {
  const entries = Object.entries(params as Record<string, unknown>).filter(
    ([, v]) => v !== undefined && v !== null
  )
  if (entries.length === 0) return ""
  const searchParams = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)])
  )
  return `?${searchParams.toString()}`
}

// ============================================================
// Error class
// ============================================================

export class ProxyClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string
  ) {
    super(message)
    this.name = "ProxyClientError"
  }
}

// ============================================================
// Client interface
// ============================================================

export interface SalesforceProxyClient {
  listings: {
    getAll(params?: ListingsParams): Promise<Listing[]>
    getById(id: string, force?: boolean): Promise<Listing>
    getUnits(id: string): Promise<Unit[]>
    getLotteryBuckets(id: string): Promise<LotteryBucket[]>
    getLotteryRanking(id: string, lotteryNumber: string): Promise<LotteryRanking>
    getPreferences(id: string): Promise<Preference[]>
    getAmi(params: AmiParams): Promise<AmiLevel[]>
    getEligible(filters: EligibilityFilters): Promise<Listing[]>
  }
  shortForm: {
    validateHousehold(
      listingId: string,
      data: EligibilityData
    ): Promise<ValidationResult>
    getApplication(id: string): Promise<Application>
    submitApplication(data: ApplicationData): Promise<Application>
    updateApplication(id: string, data: ApplicationData): Promise<Application>
    deleteApplication(id: string): Promise<void>
    getLendingInstitutions(): Promise<LendingInstitution[]>
  }
  account: {
    getApplications(contactId: string): Promise<Application[]>
    updateContact(data: ContactUpdate): Promise<Contact>
  }
}

// ============================================================
// Client implementation
// ============================================================

export function createSalesforceProxyClient(): SalesforceProxyClient {
  return {
    listings: {
      async getAll(params?: ListingsParams): Promise<Listing[]> {
        const query = params ? buildQuery(params) : ""
        const res = await proxyFetch<{ listings: Listing[] }>(`/api/v1/listings${query}`)
        return res.listings
      },

      async getById(id: string, force?: boolean): Promise<Listing> {
        const query = force ? "?force=true" : ""
        const res = await proxyFetch<{ listing: Listing }>(`/api/v1/listings/${id}${query}`)
        return res.listing
      },

      async getUnits(id: string): Promise<Unit[]> {
        const res = await proxyFetch<{ units: Unit[] }>(`/api/v1/listings/${id}/units`)
        return res.units
      },

      async getLotteryBuckets(id: string): Promise<LotteryBucket[]> {
        const res = await proxyFetch<{ lotteryBuckets: LotteryBucket[] }>(
          `/api/v1/listings/${id}/lottery_buckets`
        )
        return res.lotteryBuckets ?? []
      },

      async getLotteryRanking(
        id: string,
        lotteryNumber: string
      ): Promise<LotteryRanking> {
        const query = buildQuery({ lottery_number: lotteryNumber })
        // Rails returns the raw Salesforce response object directly
        return proxyFetch<LotteryRanking>(
          `/api/v1/listings/${id}/lottery_ranking${query}`
        )
      },

      async getPreferences(id: string): Promise<Preference[]> {
        const res = await proxyFetch<{ preferences: Preference[] }>(`/api/v1/listings/${id}/preferences`)
        return res.preferences
      },

      async getAmi(params: AmiParams): Promise<AmiLevel[]> {
        const query = buildQuery(params)
        const res = await proxyFetch<{ ami: AmiLevel[] }>(`/api/v1/listings/ami${query}`)
        return res.ami
      },

      async getEligible(filters: EligibilityFilters): Promise<Listing[]> {
        const query = buildQuery(filters)
        const res = await proxyFetch<{ listings: Listing[] }>(`/api/v1/listings/eligibility${query}`)
        return res.listings
      },
    },

    shortForm: {
      async validateHousehold(
        listingId: string,
        data: EligibilityData
      ): Promise<ValidationResult> {
        return proxyFetch<ValidationResult>(
          "/api/v1/short-form/validate-household",
          {
            method: "POST",
            body: JSON.stringify({ ...data, listingID: listingId }),
          }
        )
      },

      async getApplication(id: string): Promise<Application> {
        return proxyFetch<Application>(`/api/v1/short-form/application/${id}`)
      },

      async submitApplication(data: ApplicationData): Promise<Application> {
        return proxyFetch<Application>("/api/v1/short-form/application", {
          method: "POST",
          body: JSON.stringify(data),
        })
      },

      async updateApplication(
        id: string,
        data: ApplicationData
      ): Promise<Application> {
        return proxyFetch<Application>(`/api/v1/short-form/application/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        })
      },

      async deleteApplication(id: string): Promise<void> {
        return proxyFetch<void>(`/api/v1/short-form/application/${id}`, {
          method: "DELETE",
        })
      },

      async getLendingInstitutions(): Promise<LendingInstitution[]> {
        return proxyFetch<LendingInstitution[]>(
          "/api/v1/short-form/lending_institutions"
        )
      },
    },

    account: {
      async getApplications(contactId: string): Promise<Application[]> {
        return proxyFetch<Application[]>("/api/v1/account/my-applications", {
          headers: { "X-Contact-Id": contactId },
        })
      },

      async updateContact(data: ContactUpdate): Promise<Contact> {
        return proxyFetch<Contact>("/api/v1/account/update", {
          method: "PUT",
          body: JSON.stringify(data),
        })
      },
    },
  }
}
