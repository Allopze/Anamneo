import DashboardLayout from '@/components/layout/DashboardLayout';

export default function PacientesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
