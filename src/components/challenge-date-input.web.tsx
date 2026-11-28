
import type { ChangeEvent } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
};

export default function ChallengeDateInput({
  value,
  onChange,
  min,
}: Props) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      onChange={(event: ChangeEvent<HTMLInputElement>) =>
        onChange(event.target.value)
      }
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        padding: 14,
        border: "1px solid #CCC",
        borderRadius: 10,
        backgroundColor: "#FFF",
        color: "#222",
        fontSize: 15,
        fontFamily: "inherit",
        colorScheme: "light",
      }}
    />
  );
}
