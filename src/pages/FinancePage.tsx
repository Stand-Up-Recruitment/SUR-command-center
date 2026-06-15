import { PlaceholderCard } from '../components/departments/PlaceholderCard';

export function FinancePage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <PlaceholderCard
        department="Finance"
        description="Connect your Xero data to see P&L, cash flow, and invoice metrics."
      />
    </div>
  );
}
