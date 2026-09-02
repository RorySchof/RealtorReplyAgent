// src/components/ManualInputEmailPreview.jsx

// Design tokens mirrored from Showing Notes (theme.js)
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
};

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
 * Structured agent output using Showing Notes card / header patterns.
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
    <div style={styles.card}>
      <div style={styles.cardHeader}>Client Summary</div>
      <div style={styles.body}>
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Client Snapshot</h3>
          <table style={styles.snapshotTable}>
            <tbody>
              <tr>
                <td style={styles.snapshotLabel}>Client Status</td>
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
        </section>

        <section style={styles.callout}>
          <div style={styles.calloutHeader}>Action Items</div>
          <div style={styles.calloutBody}>
            <ul style={styles.list}>
              <ListItems items={actionItems} />
            </ul>
          </div>
        </section>

        <section style={styles.callout}>
          <div style={styles.calloutHeader}>Coach’s Insight</div>
          <div style={styles.calloutBody}>
            <ul style={styles.list}>
              <ListItems items={coachNotes} />
            </ul>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Draft Reply</h3>
          <pre style={styles.draftBody}>{draftReply || '—'}</pre>
          <div style={styles.buttonStack}>
            <a href="mailto:" style={styles.sendButton}>
              Send to Client
            </a>
            <button type="button" onClick={handleCopyReply} style={styles.copyButton}>
              Copy Reply
            </button>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Follow-Ups</h3>
          <ul style={styles.list}>
            <ListItems items={followUps} />
          </ul>
        </section>
      </div>
    </div>
  );
}

const styles = {
  card: {
    marginBottom: '2rem',
    border: `1px solid ${colors.hairline}`,
    borderRadius: '8px',
    overflow: 'hidden',
    background: colors.bg,
  },
  cardHeader: {
    ...sectionHeaderBar,
  },
  body: {
    padding: '1.5rem',
    background: colors.bg,
    fontFamily: type.fontFamily,
    color: colors.ink,
  },
  section: {
    marginBottom: '1.25rem',
  },
  sectionTitle: {
    margin: '0 0 0.75rem',
    fontSize: '1rem',
    fontWeight: 650,
    color: colors.navy,
  },
  snapshotTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.95rem',
    color: colors.ink,
  },
  snapshotLabel: {
    padding: '0.45rem 0',
    fontWeight: 600,
    width: '35%',
    color: colors.slate,
    verticalAlign: 'top',
  },
  snapshotValue: {
    padding: '0.45rem 0',
    color: colors.ink,
  },
  callout: {
    background: colors.paleAccent,
    border: `1px solid ${colors.hairline}`,
    borderRadius: '6px',
    marginBottom: '1.25rem',
    overflow: 'hidden',
  },
  calloutHeader: {
    ...sectionHeaderBar,
    borderRadius: '6px 6px 0 0',
    fontSize: '0.9rem',
  },
  calloutBody: {
    padding: '1rem 1.25rem',
  },
  draftBody: {
    whiteSpace: 'pre-wrap',
    fontSize: '0.95rem',
    lineHeight: 1.5,
    color: colors.ink,
    margin: 0,
    fontFamily: type.fontFamily,
    padding: '0.75rem',
    border: `1px solid ${colors.hairline}`,
    borderRadius: '6px',
    background: colors.bgMuted,
  },
  buttonStack: {
    marginTop: '1rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  sendButton: {
    display: 'inline-block',
    padding: '0.65rem 1.2rem',
    background: colors.navy,
    color: '#ffffff',
    textDecoration: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '0.95rem',
    fontFamily: type.fontFamily,
  },
  copyButton: {
    padding: '0.65rem 1.2rem',
    background: colors.bg,
    color: colors.navy,
    border: `1px solid ${colors.hairline}`,
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '0.95rem',
    fontFamily: type.fontFamily,
    cursor: 'pointer',
  },
  list: {
    margin: 0,
    paddingLeft: '1.25rem',
    lineHeight: 1.5,
    fontSize: '0.95rem',
    color: colors.ink,
  },
  listItem: {
    marginBottom: '0.35rem',
  },
  listItemEmpty: {
    fontStyle: 'italic',
    color: colors.slateLight,
  },
};
