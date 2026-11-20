import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="19 November 2026">
      <p>MockView is a practice tool for technical interviews. This page explains what it stores, who can see it and how to delete it.</p>

      <h2>What we store</h2>
      <ul>
        <li><strong>Your account:</strong> your email address and sign-in, handled by our authentication provider (Supabase).</li>
        <li><strong>Your interviews:</strong> the settings you chose, the questions asked, the <em>text</em> of your answers, the scores and the report generated from them.</li>
        <li><strong>Optional extras:</strong> the text of a resume (only if you upload one and tick the consent box) and any job description or custom instructions you type.</li>
        <li><strong>Usage counts:</strong> a timestamp and your account id each time you start an interview, so daily limits work. These contain no interview content.</li>
        <li><strong>Server logs:</strong> request time, page address and status. We do not log request bodies, answers or resume text.</li>
      </ul>

      <h2>Your voice</h2>
      <p>MockView never records or stores audio. For spoken interviews your browser turns your speech into text, and the interviewer&apos;s voice is your device&apos;s built-in voice. In Chrome the speech-to-text service is run by Google, in Edge by Microsoft and in Safari by Apple, so your audio may be sent to them under their own privacy policies. If you prefer, choose typing instead of the microphone.</p>
      <p>In the desktop app, your answer is recorded briefly in the app and sent, using the Gemini API key you entered, to Google to be turned into text. MockView does not save the recording. Without a key, type your answers.</p>

      <h2>AI processing</h2>
      <p>When the site is connected to an AI provider, your answers, and any resume text or job description you added, are sent to that provider to generate questions and feedback. When no provider is connected the site runs in a clearly labeled demo mode, uses simulated feedback and sends nothing to any AI provider. The page header and your report say which mode applies.</p>

      <h2>Who can see your data</h2>
      <p>Only you, through your account. Site administrators can see usage statistics and interview metadata (field, level, status, score) but not your answers, resume text or job descriptions. We do not sell your data and do not use it for advertising.</p>

      <h2>Keeping and deleting your data</h2>
      <ul>
        <li>Your data is kept until you delete it.</li>
        <li>You can delete any interview or uploaded resume at any time from your dashboard.</li>
        <li>You can delete <strong>all</strong> of your data from the dashboard (&ldquo;Delete my account data&rdquo;). Depending on how the site is set up, this also removes your sign-in account; if it does not, ask the operator to remove it.</li>
        <li>Only the content-free usage counts described above are retained after deletion, to keep daily limits fair.</li>
      </ul>

      <h2>Not for hiring decisions</h2>
      <p>Scores describe how one practice answer was evaluated. They are not assessments of you and must not be used for hiring or any decision about a person.</p>

      <h2>Children</h2>
      <p>MockView is not directed at children and should not be used by anyone under 16.</p>

      <h2>Changes</h2>
      <p>If this policy changes, the date above will change with it.</p>
    </LegalPage>
  );
}
