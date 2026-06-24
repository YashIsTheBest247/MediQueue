export default function BrandMark({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3.6V7a4 4 0 0 0 8 0V3.6" />
      <path d="M13 11v2.7A4.3 4.3 0 0 0 17.3 18" />
      <circle cx="19.1" cy="17.7" r="2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="3.3" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="17" cy="3.3" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="4.8" cy="11.6" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="4.8" cy="15.6" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="4.8" cy="19.6" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}
