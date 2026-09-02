// src/pages/ManualInput.jsx

import { useState } from 'react';
import ManualInputEmailPreview from '../components/ManualInputEmailPreview';

export default function ManualInput() {
  console.log("ManualInput rendered");
  const [text, setText] = useState('');
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [buttonHovered, setButtonHovered] = useState(false);

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

  const buttonDisabled = loading || !text.trim();

  return (
    <div style={styles.page}>
      <div style={styles.formCard}>
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
            style={{
              ...styles.button,
              ...(buttonHovered && !buttonDisabled ? styles.buttonHover : {}),
              ...(buttonDisabled ? styles.buttonDisabled : {}),
            }}
            onClick={handleGenerate}
            disabled={buttonDisabled}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => setButtonHovered(false)}
          >
            Generate Reply
          </button>
        </div>

        {loading && <p style={styles.status}>Generating reply...</p>}

        {error && <p style={styles.error}>{error}</p>}
      </div>

      {agent && !loading && <ManualInputEmailPreview agent={agent} />}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: '640px',
    margin: '0 auto',
    padding: '24px',
    fontFamily: 'Arial, sans-serif',
    color: '#374151',
    lineHeight: 1.6,
    background: '#f7f7f7',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  formCard: {
    background: '#fcfcfc',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  heading: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 24px',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#111827',
  },
  textarea: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif',
    lineHeight: 1.6,
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    background: '#ffffff',
    resize: 'vertical',
    boxSizing: 'border-box',
    outline: 'none',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  button: {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    padding: '12px 16px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif',
    cursor: 'pointer',
    boxSizing: 'border-box',
    transition: 'background 0.15s ease',
  },
  buttonHover: {
    background: '#1d4ed8',
  },
  buttonDisabled: {
    background: '#93c5fd',
    cursor: 'not-allowed',
  },
  status: {
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    color: '#6b7280',
    margin: '16px 0 0',
  },
  error: {
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    color: '#b00020',
    margin: '16px 0 0',
  },
};
