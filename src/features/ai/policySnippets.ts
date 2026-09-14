export const POLICY_SNIPPETS = [
  {
    id: "hardship-fee-extension",
    title: "Hardship fee extension",
    body: "If a parent is hospitalized or the household has a documented emergency, the centre may grant a one-time fee installment extension of up to 10 days. Staff must record the new due date in the case reply. Extensions are not automatic templates — a human must approve the date."
  },
  {
    id: "missed-class-recordings",
    title: "Missed-class recordings",
    body: "Students who miss class may request the recording for that session. Physics, Chemistry, and Biology recordings are released by the batch teacher within 24 hours of a logged Class Access case. Recordings are not posted to public Facebook groups."
  },
  {
    id: "exam-schedule",
    title: "Exam schedule",
    body: "Model-test dates are published on the batch notice board and the centre Facebook page. Staff should confirm the next test date from the batch calendar rather than guessing. Schedule changes are announced at least 48 hours in advance."
  },
  {
    id: "repeat-followup",
    title: "Repeat requester follow-up",
    body: "A third case from the same student in six weeks is a personal follow-up, not another template. Support staff should offer a phone call or in-person desk visit and notify the branch manager."
  }
] as const;

export function policySnippetText(): string {
  return POLICY_SNIPPETS.map((snippet) => `${snippet.title}: ${snippet.body}`).join("\n\n");
}
