import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardPage from './(dashboard)/page';

export default function HomePage() {
	return (
		<DashboardLayout>
			<DashboardPage />
		</DashboardLayout>
	);
}
