import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { processMessage } from '../agent';
import OutputSection from '../components/OutputSection';


const STORAGE_KEY = 'realtor-reply-agent-last-output';

const emptyOutput = {
  action_items: [],
  client_questions: [],
  followup_items: [],
  reply: '',
};

export default function Share() {
  const [searchParams] = useSearchParams();
  const [output, setOutput] = useState(emptyOutput);
  const [replyText, setReplyText] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const hasRunRef = useRef(false);

  useEffect(() => {
    const sharedText = searchParams.get('text');
  
    // If no text, load from localStorage
    if (!sharedText) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setOutput(parsed);
          setReplyText(parsed.reply || '');
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      return;
    }
  
    // ⭐ Prevent double execution in React Strict Mode
    if (hasRunRef.current) return;
    hasRunRef.current = true;
  
    runProcess(sharedText);
  }, [searchParams]);
  

  async function runProcess(inputText) {
    setLoading(true);
    setError(null);

    try {
      const result = await processMessage(inputText);
      setOutput(result);
      setReplyText(result.reply);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } catch {
      setError('Something went wrong generating the action plan. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopyReply() {
    navigator.clipboard.writeText(replyText);
  }

  async function handleShareReply() {
    await navigator.share({ text: replyText });
  }

  if (loading) {
    return <p style={styles.status}>Processing...</p>;
  }

  if (error) {
    return <p style={styles.error}>{error}</p>;
  }

  const hasContent =
    output.action_items.length > 0 ||
    output.client_questions.length > 0 ||
    output.followup_items.length > 0 ||
    replyText;

  if (!hasContent) {
    return <p style={styles.status}>Share an email to get started.</p>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Realtor Reply Agent</h1>

      <OutputSection title="Action Items" items={output.action_items} />
      <OutputSection title="Questions for Client" items={output.client_questions} />
      <OutputSection title="Follow-up Items" items={output.followup_items} />

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Draft Reply</h2>
        <textarea
          style={styles.textarea}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          rows={10}
        />
      </section>

      <div style={styles.buttons}>
        {canShare && (
          <button type="button" style={styles.button} onClick={handleShareReply}>
            Share Reply
          </button>
        )}
        <button type="button" style={styles.button} onClick={handleCopyReply}>
          Copy Reply
        </button>
      </div>
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
  },
  button: {
    padding: '0.6rem 1.2rem',
    fontSize: '1rem',
    cursor: 'pointer',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: '#fff',
  },
  status: {
    maxWidth: '640px',
    margin: '2rem auto',
    padding: '0 1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#666',
  },
  error: {
    maxWidth: '640px',
    margin: '2rem auto',
    padding: '0 1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#b00020',
  },
};
