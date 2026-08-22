// src/pages/ManualInput.jsx

import { useState } from 'react';
import OutputSection from '../components/OutputSection';

function asList(value) {
  return Array.isArray(value) ? value : [];
}

export default function ManualInput() {
  console.log("ManualInput rendered");
  const [text, setText] = useState('');
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleGenerate() {
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setAgent(null);

    try {
      const response = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const data = await response.json();
      setAgent(data || {});
    } catch {
      setError('Something went wrong generating the reply. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const snapshot = agent?.client_snapshot || {};
  const actionItems = asList(agent?.action_items);
  const followUps = asList(agent?.followups?.length ? agent.followups : agent?.followup_items);
  const coachNotes = asList(agent?.coach_notes);
  const clientQuestions = asList(agent?.client_questions);
  const rapportQuestions = asList(agent?.rapport_questions);
  const questionsForClient = asList(
    agent?.questions_for_client?.length ? agent.questions_for_client : agent?.client_questions
  );
  const draftReply = agent?.draft_reply || agent?.reply || '';

  const hasAgent = agent && !loading;

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Manual Input</h1>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Paste Email</h2>
        <textarea
          style={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder="Paste the email here..."
          disabled={loading}
        />
      </section>

      <div style={styles.buttons}>
        <button
          type="button"
          style={styles.button}
          onClick={handleGenerate}
          disabled={loading || !text.trim()}
        >
          Generate Reply
        </button>
      </div>

      {loading && <p style={styles.status}>Generating reply...</p>}

      {error && <p style={styles.error}>{error}</p>}

      {hasAgent && (
        <>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Client Snapshot</h2>
            <div style={styles.resultBox}>
              <div>Client Status: {snapshot.client_status || '—'}</div>
              {snapshot.primary_concern != null && snapshot.primary_concern !== '' && (
                <div>Primary Concern: {snapshot.primary_concern}</div>
              )}
              <div>Decision Factors: {snapshot.decision_factors || '—'}</div>
              <div>Momentum Signal: {snapshot.momentum_signal || '—'}</div>
              {snapshot.confidence != null && snapshot.confidence !== '' && (
                <div>Confidence: {snapshot.confidence}</div>
              )}
            </div>
          </section>

          <OutputSection title="Action Items" items={actionItems} />
          <OutputSection title="Follow-Ups" items={followUps} />
          <OutputSection title="Coach's Notes" items={coachNotes} />
          <OutputSection title="Questions FROM Client" items={clientQuestions} />
          <OutputSection title="Rapport Questions" items={rapportQuestions} />
          <OutputSection title="Questions FOR Client" items={questionsForClient} />

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Draft Reply</h2>
            <div style={styles.resultBox}>{draftReply || '—'}</div>
          </section>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '640px',
    margin: '0 auto',
    padding: '1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#222',
    lineHeight: 1.5,
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginBottom: '1.5rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '1rem',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    border: '1px solid #ccc',
    borderRadius: '4px',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  buttons: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '1.5rem',
  },
  button: {
    padding: '0.6rem 1.2rem',
    fontSize: '1rem',
    cursor: 'pointer',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: '#fff',
  },
  resultBox: {
    padding: '0.75rem',
    fontSize: '1rem',
    lineHeight: 1.5,
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: '#fafafa',
    whiteSpace: 'pre-wrap',
  },
  status: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#666',
    marginBottom: '1rem',
  },
  error: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#b00020',
    marginBottom: '1rem',
  },
};
