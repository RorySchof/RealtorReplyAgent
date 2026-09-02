// src/pages/ManualInput.jsx

import { useState } from 'react';
import ManualInputEmailPreview from '../components/ManualInputEmailPreview';

// Design tokens mirrored from Showing Notes (theme.js / pageStyles.js)
const colors = {
  ink: '#1A2331',
  slate: '#4B5768',
  slateLight: '#8592A3',
  navy: '#1B3A4B',
  navyDark: '#132A37',
  paleAccent: '#E7EEF0',
  hairline: '#DCE3E8',
  bgMuted: '#F7F9FA',
  bg: '#FFFFFF',
  danger: '#9C3B3B',
};

const type = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
};

const sectionHeaderBar = {
  background: colors.navy,
  color: '#FFFFFF',
  padding: '0.65rem 1.25rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  borderRadius: '6px 6px 0 0',
};

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
      <header style={styles.header}>
        <h1 style={styles.title}>Realtor Reply</h1>
        <p style={styles.subtitle}>Draft professional replies to client messages</p>
      </header>

      <div style={styles.card}>
        <div style={styles.cardHeader}>Manual Input</div>
        <div style={styles.form}>
          <label style={styles.label}>
            Paste Email
            <textarea
              style={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Paste the email here..."
              disabled={loading}
            />
          </label>

          {error ? <p style={styles.error}>{error}</p> : null}

          {loading ? <p style={styles.status}>Generating reply...</p> : null}

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
      </div>

      {agent && !loading && <ManualInputEmailPreview agent={agent} />}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
    fontFamily: type.fontFamily,
    color: colors.ink,
    lineHeight: 1.5,
    background: colors.bg,
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  header: {
    marginBottom: '1.75rem',
    paddingBottom: '1.25rem',
    borderBottom: `1px solid ${colors.hairline}`,
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 650,
    margin: 0,
    color: colors.navy,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: '0.35rem 0 0',
    color: colors.slate,
    fontSize: '0.95rem',
  },
  card: {
    marginBottom: '2rem',
    border: `1px solid ${colors.hairline}`,
    borderRadius: '8px',
    overflow: 'hidden',
    background: colors.bg,
  },
  cardHeader: {
    ...sectionHeaderBar,
    borderRadius: 0,
  },
  form: {
    padding: '1.5rem',
    background: colors.bg,
  },
  label: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: 500,
    marginBottom: '0.85rem',
    color: colors.ink,
  },
  textarea: {
    display: 'block',
    width: '100%',
    marginTop: '0.35rem',
    padding: '0.75rem',
    fontSize: '0.95rem',
    border: `1px solid ${colors.hairline}`,
    borderRadius: '6px',
    boxSizing: 'border-box',
    fontFamily: type.fontFamily,
    color: colors.ink,
    lineHeight: 1.5,
    resize: 'vertical',
    background: colors.bg,
  },
  button: {
    padding: '0.65rem 1.2rem',
    fontSize: '0.95rem',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '6px',
    background: colors.navy,
    color: '#fff',
    fontWeight: 600,
    fontFamily: type.fontFamily,
  },
  buttonHover: {
    background: colors.navyDark,
  },
  buttonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  status: {
    color: colors.slate,
    fontSize: '0.9rem',
    margin: '0 0 0.75rem',
  },
  error: {
    color: colors.danger,
    fontSize: '0.9rem',
    margin: '0 0 0.75rem',
  },
};
