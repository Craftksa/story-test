import {NextRequest, NextResponse} from 'next/server';
import {projects, tasks, users} from '@/drizzle/schema';
import {and, count, eq, gte, sql} from 'drizzle-orm';
import {db} from "@/drizzle/db";
import {authenticate} from "@/lib/authenticate";
import {hasRole} from '@/lib/utils';

export async function GET(request: NextRequest) {
	const { user: userAuth } = await authenticate(request);
	try {
	if (!hasRole(userAuth, ["admin", "moderator"])) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// Get overview metrics
		const [
			totalProjects,
			totalUsers,
			totalTasks,
			usersByRole,
			projectsByStatus,
			tasksByStatus,
			tasksByType
		] = await Promise.all([
			// Total projects
			db.select({ count: count() }).from(projects),

			// Total users
			db.select({ count: count() }).from(users),

			// Total tasks
			db.select({ count: count() }).from(tasks),

			// Users by role
			db.select({
				role: users.role,
				count: count()
			}).from(users).groupBy(users.role),

			// Projects by status
			db.select({
				status: projects.status,
				count: count()
			}).from(projects).groupBy(projects.status),

			// Tasks by status
			db.select({
				status: tasks.status,
				count: count()
			}).from(tasks).groupBy(tasks.status),

			// Tasks by type
			db.select({
				type: tasks.type,
				count: count()
			}).from(tasks).groupBy(tasks.type)
		]);

		// Get projects by city
		const projectsByCity = await db.select({
				city: projects.city,
				projectCount: sql<number>`count(distinct ${projects.id})`,
				taskCount: sql<number>`count(${tasks.id})`
			})
			.from(projects)
			.leftJoin(tasks, eq(projects.id, tasks.projectId))
			.groupBy(projects.city);

		// Get projects by type
		const projectsByType = await db.select({
			projectType: projects.projectType,
			count: count()
		}).from(projects).groupBy(projects.projectType);

		// Get monthly progress (last 6 months)
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

		const monthlyCompletedProjects = await db.select({
				label: sql<string>`to_char(${projects.updatedAt}, 'Mon')`,
				month: sql<number>`extract(month from ${projects.updatedAt})`,
				year: sql<number>`extract(year from ${projects.updatedAt})`,
				count: count()
			})
			.from(projects)
			.where(
				and(
					eq(projects.status, 'completed'),
					gte(projects.updatedAt, sixMonthsAgo)
				)
			)
			.groupBy(
				sql`to_char(${projects.updatedAt}, 'Mon')`,
				sql`extract(month from ${projects.updatedAt})`,
				sql`extract(year from ${projects.updatedAt})`
			)
			.orderBy(
				sql`extract(year from ${projects.updatedAt})`,
				sql`extract(month from ${projects.updatedAt})`
			);

		const monthlyStartedProjects = await db.select({
				label: sql<string>`to_char(${projects.createdAt}, 'Mon')`,
				month: sql<number>`extract(month from ${projects.createdAt})`,
				year: sql<number>`extract(year from ${projects.createdAt})`,
				count: count()
			})
			.from(projects)
			.where(gte(projects.createdAt, sixMonthsAgo))
			.groupBy(
				sql`to_char(${projects.createdAt}, 'Mon')`,
				sql`extract(month from ${projects.createdAt})`,
				sql`extract(year from ${projects.createdAt})`
			)
			.orderBy(
				sql`extract(year from ${projects.createdAt})`,
				sql`extract(month from ${projects.createdAt})`
			);

		// Get recent activity (latest 3 projects by updatedAt)
		const recentActivity = await db.select({
				name: projects.name,
				status: projects.status,
				city: projects.city,
				updatedAt: projects.updatedAt
			})
			.from(projects)
			.orderBy(sql`${projects.updatedAt} desc`)
			.limit(3);

		// Calculate overview metrics
		const totalProjectsCount = totalProjects[0].count;
		const totalUsersCount = totalUsers[0].count;
		const totalTasksCount = totalTasks[0].count;

		const activeProjects = projectsByStatus
			.filter(p => ['in_progress', 'not_started'].includes(p.status))
			.reduce((sum, p) => sum + p.count, 0);

		const completedProjects = projectsByStatus.find(p => p.status === 'completed')?.count || 0;

		// Calculate user counts by role
		const adminUsers = usersByRole.find(u => u.role === 'admin')?.count || 0;
		const employeeUsers = (usersByRole.find(u => u.role === 'employee')?.count || 0) +
			(usersByRole.find(u => u.role === 'moderator')?.count || 0);
		const clientUsers = usersByRole.find(u => u.role === 'client')?.count || 0;

		// Calculate task metrics
		const completedTasks = tasksByStatus.find(t => t.status === 'completed')?.count || 0;
		const foundationTasks = tasksByType.find(t => t.type === 'foundations')?.count || 0;
		const finishTasks = tasksByType.find(t => t.type === 'finishes')?.count || 0;

		// Helper function to combine monthly data
		function combineMonthlyData(
			completed: { month: number; year: number; count: number }[],
			started: { month: number; year: number; count: number }[]
		) {
			const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			const combined: { month: string; completed: number; started: number }[] = [];

			// Get last 6 months
			const now = new Date();
			for (let i = 5; i >= 0; i--) {
				const date = new Date(now.getFullYear(), now.getMonth() - i);
				const monthName = months[date.getMonth()];
				const month = date.getMonth() + 1;
				const year = date.getFullYear();

				const completedCount = completed.find(c => c.month === month && c.year === year)?.count || 0;
				const startedCount = started.find(s => s.month === month && s.year === year)?.count || 0;

				combined.push({
					month: monthName,
					completed: completedCount,
					started: startedCount
				});
			}

			return combined;
		}

		// Format the response to match your mock data structure exactly
		const dashboardData = {
			overview: {
				totalProjects: totalProjectsCount,
				activeProjects: activeProjects,
				completedProjects: completedProjects,
				totalUsers: totalUsersCount,
				adminUsers: adminUsers,
				employeeUsers: employeeUsers,
				clientUsers: clientUsers
			},

			projectsByStatus: projectsByStatus.map(p => ({
				status: p.status,
				count: p.count,
				fill: `var(--color-${p.status})`
			})),

			projectsByType: projectsByType.map(p => ({
				name: p.projectType.charAt(0).toUpperCase() + p.projectType.slice(1),
				count: p.count,
				percentage: Math.round((p.count / totalProjectsCount) * 100)
			})),

			cityDistribution: projectsByCity.map(city => ({
				city: city.city,
				projects: city.projectCount,
				tasks: city.taskCount
			})),

			monthlyProgress: combineMonthlyData(monthlyCompletedProjects, monthlyStartedProjects),

			taskMetrics: {
				totalTasks: totalTasksCount,
				foundationTasks: foundationTasks,
				finishTasks: finishTasks,
				completedTasks: completedTasks,
				pendingTasks: totalTasksCount - completedTasks
			},

			taskTypes: [
				{ type: "foundation", count: foundationTasks, fill: "var(--color-foundation)" },
				{ type: "finish", count: finishTasks, fill: "var(--color-finish)" }
			],

			recentActivity: recentActivity.map(activity => ({
				project: activity.name,
				status: activity.status,
				city: activity.city,
				date: activity.updatedAt?.toISOString().split('T')[0] || ''
			}))
		};

		return NextResponse.json(dashboardData);

	} catch (error) {
		console.error('Dashboard API Error:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}
