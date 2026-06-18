export default function OutputSection({ title, items }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.title}>{title}</h2>
      {items.length === 0 ? (
        <p style={styles.empty}>None</p>
      ) : (
        <ul style={styles.list}>
          {items.map((item, index) => (
            <li key={index} style={styles.listItem}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const styles = {
  section: {
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  list: {
    margin: 0,
    paddingLeft: '1.25rem',
  },
  listItem: {
    marginBottom: '0.35rem',
    lineHeight: 1.5,
  },
  empty: {
    margin: 0,
    color: '#666',
    fontStyle: 'italic',
  },
};
