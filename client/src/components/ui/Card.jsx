import styles from './Card.module.css';

export default function Card({ title, subtitle, children, style }) {
  return (
    <div className={styles.card} style={style}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {subtitle && <p className={styles.sub}>{subtitle}</p>}
      {children}
    </div>
  );
}
