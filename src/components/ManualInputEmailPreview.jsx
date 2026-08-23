// src/components/ManualInputEmailPreview.jsx

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function ListItems({ items }) {
  const list = asList(items);
  if (list.length === 0) {
    return <li style={styles.listItemEmpty}>None</li>;
  }
  return list.map((item, index) => (
    <li key={index} style={styles.listItem}>
      {String(item)}
    </li>
  ));
}

/**
 * Visual copy of the inbound-email HTML summary (cards, table, colors, shadows).
 * Does not share code with inbound-email.js — styles were mirrored from that template.
 */
export default function ManualInputEmailPreview({ agent }) {
  const snapshot = agent?.client_snapshot || {};
  const actionItems = asList(agent?.action_items);
  const coachNotes = asList(agent?.coach_notes);
  const followUps = asList(
    agent?.followups?.length ? agent.followups : agent?.followup_items
  );
  const draftReply = agent?.draft_reply || agent?.reply || '';

  async function handleCopyReply(e) {
    e.preventDefault();
    if (!draftReply) return;
    try {
      await navigator.clipboard.writeText(draftReply);
    } catch {
      // Ignore clipboard failures in unsupported environments
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>Realtor Assistant — Client Summary</div>

      <div style={styles.snapshotCard}>
        <div style={styles.snapshotTitle}>Client Snapshot</div>
        <table style={styles.snapshotTable}>
          <tbody>
            <tr>
              <td style={styles.snapshotLabelWide}>Client Status</td>
              <td style={styles.snapshotValue}>{snapshot.client_status || '—'}</td>
            </tr>
            <tr>
              <td style={styles.snapshotLabel}>Decision Factors</td>
              <td style={styles.snapshotValue}>{snapshot.decision_factors || '—'}</td>
            </tr>
            <tr>
              <td style={styles.snapshotLabel}>Momentum Signal</td>
              <td style={styles.snapshotValue}>{snapshot.momentum_signal || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={styles.actionCard}>
        <div style={styles.actionTitle}>Action Items</div>
        <ul style={styles.list}>
          <ListItems items={actionItems} />
        </ul>
      </div>

      <div style={styles.coachCard}>
        <div style={styles.coachTitle}>Coach’s Insight</div>
        <ul style={styles.list}>
          <ListItems items={coachNotes} />
        </ul>
      </div>

      <div style={styles.draftCard}>
        <div style={styles.draftTitle}>Draft Reply</div>
        <pre style={styles.draftBody}>{draftReply || '—'}</pre>
        <div style={styles.buttonStack}>
          <a href="mailto:" style={styles.sendButton}>
            Send to Client
          </a>
          <a href="#" onClick={handleCopyReply} style={styles.copyButton}>
            Copy Reply
          </a>
        </div>
      </div>

      <div style={styles.followUpCard}>
        <div style={styles.followUpTitle}>Follow-Ups</div>
        <ul style={styles.list}>
          <ListItems items={followUps} />
        </ul>
      </div>
    </div>
  );
}

const styles = {
  page: {
    background: '#f7f7f7',
    padding: '24px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    textAlign: 'left',
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '24px',
  },
  snapshotCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  snapshotTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#111827',
  },
  snapshotTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    color: '#374151',
  },
  snapshotLabelWide: {
    padding: '8px 0',
    fontWeight: 600,
    width: '35%',
  },
  snapshotLabel: {
    padding: '8px 0',
    fontWeight: 600,
  },
  snapshotValue: {
    padding: '8px 0',
  },
  actionCard: {
    background: '#f8fbff',
    border: '1px solid #dbeafe',
    borderLeft: '4px solid #2563eb',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  actionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#1e3a8a',
  },
  coachCard: {
    background: '#f5faff',
    border: '1px solid #dbeafe',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  coachTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#1e3a8a',
  },
  draftCard: {
    background: '#fcfcfc',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  draftTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#111827',
  },
  draftBody: {
    whiteSpace: 'pre-wrap',
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#374151',
    margin: 0,
    fontFamily: 'Arial, sans-serif',
  },
  buttonStack: {
    marginTop: '20px',
  },
  sendButton: {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    padding: '12px 16px',
    background: '#2563eb',
    color: '#ffffff',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '14px',
    marginBottom: '12px',
    boxSizing: 'border-box',
  },
  copyButton: {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    padding: '12px 16px',
    background: '#6b7280',
    color: '#ffffff',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  followUpCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  followUpTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#111827',
  },
  list: {
    margin: 0,
    paddingLeft: '20px',
    lineHeight: 1.6,
    fontSize: '14px',
    color: '#374151',
  },
  listItem: {},
  listItemEmpty: {
    fontStyle: 'italic',
    color: '#9ca3af',
  },
};
