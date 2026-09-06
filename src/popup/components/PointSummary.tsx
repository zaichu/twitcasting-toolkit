import type { PointSummaryItem } from "../popupHelpers";

type PointSummaryProps = {
  items: PointSummaryItem[];
};

export const PointSummary = ({ items }: PointSummaryProps) => {
  return (
    <div className="point-summary" aria-label="ポイント情報">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
};
