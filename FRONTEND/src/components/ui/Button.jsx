import styles from './Button.module.css';

export default function Button({ children, variant='solid', ...props }) {
  const className = variant === 'ghost' ? `${styles.btn} ${styles.ghost}` : styles.btn;
  return <button className={className} {...props}>{children}</button>;
}
