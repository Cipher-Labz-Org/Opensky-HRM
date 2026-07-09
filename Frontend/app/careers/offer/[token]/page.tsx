"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { publicApiFetch } from "@/lib/api";
import { fetchCompanyBranding, type CompanyBranding } from "@/lib/company-branding";
import { prepareOfferLetterHtmlForPublicResponse } from "@/lib/offer-letter-html";
import { APP_NAME } from "@/config/constants";

type PublicOffer = {
  candidateName: string;
  positionTitle: string;
  salaryOffered: number;
  currency?: string;
  joiningDate?: string;
  expiryDate?: string;
  status: string;
  canRespond: boolean;
  isAccepted: boolean;
  isRejected: boolean;
  hasNegotiationRequest: boolean;
  negotiationMessage?: string;
  negotiationRequestedAt?: string;
  letterHtml?: string;
  responseMessage?: string;
};

type ResponseMode = "accept" | "reject" | "negotiate" | null;

export default function PublicOfferResponsePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = String(params.token ?? "");

  const [offer, setOffer] = useState<PublicOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<CompanyBranding>({ companyName: APP_NAME, companyLogoUrl: null });
  const [mode, setMode] = useState<ResponseMode>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [negotiationMessage, setNegotiationMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const responseBaseUrl = `/careers/offer/${token}`;

  const loadOffer = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await publicApiFetch<PublicOffer>(`/api/recruitment/public/offers/${token}`);
      setOffer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this offer.");
      setOffer(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadOffer();
  }, [loadOffer]);

  useEffect(() => {
    void fetchCompanyBranding().then(setBranding);
  }, []);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "accept" || action === "reject" || action === "negotiate") {
      setMode(action);
    }
  }, [searchParams]);

  const letterHtml = useMemo(
    () =>
      offer?.letterHtml
        ? prepareOfferLetterHtmlForPublicResponse(
            offer.letterHtml,
            branding,
            offer.canRespond ? responseBaseUrl : undefined,
          )
        : "",
    [offer?.letterHtml, offer?.canRespond, branding, responseBaseUrl],
  );

  async function submitResponse(nextMode: ResponseMode) {
    if (!token || !nextMode) return;
    setSubmitting(true);
    setError(null);
    try {
      let result: PublicOffer;
      if (nextMode === "accept") {
        result = await publicApiFetch<PublicOffer>(`/api/recruitment/public/offers/${token}/accept`, { method: "POST" });
      } else if (nextMode === "reject") {
        result = await publicApiFetch<PublicOffer>(`/api/recruitment/public/offers/${token}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason: rejectReason.trim() || null }),
        });
      } else {
        result = await publicApiFetch<PublicOffer>(`/api/recruitment/public/offers/${token}/negotiate`, {
          method: "POST",
          body: JSON.stringify({ message: negotiationMessage.trim() }),
        });
      }
      setOffer(result);
      setSuccessMessage(result.responseMessage ?? "Your response has been recorded.");
      setMode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your response.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Offer response</p>
            <h1 className="text-2xl font-bold text-slate-900">{branding.companyName}</h1>
          </div>
          <Link href="/login" className="text-sm font-semibold text-[#2563eb] hover:underline">
            Careers home
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading offer…</div>
        ) : error && !offer ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">{error}</div>
        ) : offer ? (
          <div className="space-y-6">
            {successMessage ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800">{successMessage}</div>
            ) : null}

            {offer.isAccepted ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800">
                You have accepted this offer for <strong>{offer.positionTitle}</strong>. HR will contact you with onboarding details.
              </div>
            ) : null}

            {offer.isRejected ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
                This offer has been declined.
              </div>
            ) : null}

            {offer.hasNegotiationRequest ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
                <p className="font-semibold">Negotiation request sent</p>
                <p className="mt-2 text-sm">{offer.negotiationMessage}</p>
              </div>
            ) : null}

            {mode === "accept" && offer.canRespond ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Accept this offer?</h3>
                <p className="mt-2 text-sm text-slate-600">By accepting, you confirm that you agree to the offer details in this letter.</p>
                <div className="mt-4 flex gap-3">
                  <button type="button" disabled={submitting} onClick={() => void submitResponse("accept")} className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {submitting ? "Submitting…" : "Confirm acceptance"}
                  </button>
                  <button type="button" onClick={() => setMode(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
                </div>
              </div>
            ) : null}

            {mode === "reject" && offer.canRespond ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Decline this offer</h3>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  placeholder="Optional reason for declining"
                  className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <div className="mt-4 flex gap-3">
                  <button type="button" disabled={submitting} onClick={() => void submitResponse("reject")} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {submitting ? "Submitting…" : "Confirm decline"}
                  </button>
                  <button type="button" onClick={() => setMode(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
                </div>
              </div>
            ) : null}

            {mode === "negotiate" && offer.canRespond ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Request negotiation</h3>
                <textarea
                  value={negotiationMessage}
                  onChange={(e) => setNegotiationMessage(e.target.value)}
                  rows={5}
                  placeholder="Describe what you would like to negotiate (salary, joining date, etc.)"
                  className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <div className="mt-4 flex gap-3">
                  <button type="button" disabled={submitting || !negotiationMessage.trim()} onClick={() => void submitResponse("negotiate")} className="rounded-xl bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {submitting ? "Submitting…" : "Send request"}
                  </button>
                  <button type="button" onClick={() => setMode(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
                </div>
              </div>
            ) : null}

            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

            {letterHtml ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="p-4" dangerouslySetInnerHTML={{ __html: letterHtml }} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
