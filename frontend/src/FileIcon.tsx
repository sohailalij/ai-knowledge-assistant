interface FileIconProps {
  mimeType: string;
}

export default function FileIcon({ mimeType }: FileIconProps) {
  const isPdf = mimeType === "application/pdf";
  const color = isPdf ? "#c98a3e" : "#6b8f71";

  return (
    <svg
      width="12"
      height="15"
      viewBox="0 0 12 15"
      style={{ verticalAlign: "-2px", marginRight: "5px", flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M1 1C1 0.6 1.3 0.3 1.7 0.3H7L11 4.3V13.5C11 13.9 10.7 14.2 10.3 14.2H1.7C1.3 14.2 1 13.9 1 13.5V1Z"
        fill="none"
        stroke={color}
        strokeWidth="1"
      />
      <path d="M7 0.3V4.3H11" fill="none" stroke={color} strokeWidth="1" />
    </svg>
  );
}
