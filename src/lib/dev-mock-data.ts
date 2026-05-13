type UserRole = "admin" | "moderator" | "employee" | "client";
type ProjectStatus =
	| "not_started"
	| "in_progress"
	| "completed"
	| "on_hold"
	| "needs_review";
type TaskType = "foundations" | "finishes";
type TaskStatus =
	| "not_started"
	| "in_progress"
	| "completed"
	| "on_hold"
	| "needs_review";

type MockUser = {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	image: string | null;
};

type MockProjectSeed = {
	id: string;
	name: string;
	status: ProjectStatus;
	city: string;
	district: string;
	projectType: "villa" | "palace";
	description: string;
	clientId: string;
	designer: string;
	assignedTo: string[];
	taskCount: number;
	startOffsetDays: number;
	durationDays: number;
	updatedOffsetDays: number;
	incompletePlan: TaskStatus[];
};

type MockProject = Omit<MockProjectSeed, "taskCount" | "startOffsetDays" | "durationDays" | "updatedOffsetDays" | "incompletePlan"> & {
	startDate: Date;
	endDate: Date;
	createdAt: Date;
	updatedAt: Date;
};

type MockTask = {
	id: string;
	projectId: string;
	name: string;
	status: TaskStatus;
	type: TaskType;
	startDate: Date;
	endDate: Date;
	createdAt: Date;
	updatedAt: Date;
	notes: string;
};

type MockTaskImage = {
	id: string;
	taskId: string;
	url: string;
	description: string | null;
	uploadedAt: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date();

const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
const daysAfter = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

const mockUsers: MockUser[] = [
	{ id: "usr-admin-001", name: "Faisal Alotaibi", email: "faisal@craft.local", role: "admin", image: null },
	{ id: "usr-mod-001", name: "Lama Alharbi", email: "lama@craft.local", role: "moderator", image: null },
	{ id: "usr-emp-001", name: "Yousef Alqahtani", email: "yousef@craft.local", role: "employee", image: null },
	{ id: "usr-emp-002", name: "Nawaf Almutairi", email: "nawaf@craft.local", role: "employee", image: null },
	{ id: "usr-emp-003", name: "Rakan Alsubaie", email: "rakan@craft.local", role: "employee", image: null },
	{ id: "usr-client-001", name: "Abdullah Alshammari", email: "abdullah.client@craft.local", role: "client", image: null },
	{ id: "usr-client-002", name: "Sara Alenezi", email: "sara.client@craft.local", role: "client", image: null },
	{ id: "usr-client-003", name: "Khalid Alghamdi", email: "khalid.client@craft.local", role: "client", image: null },
	{ id: "usr-client-004", name: "Reem Alrashid", email: "reem.client@craft.local", role: "client", image: null },
];

const projectSeeds: MockProjectSeed[] = [
	{
		id: "prj-riyadh-001",
		name: "Nakheel Villa Compound",
		status: "in_progress",
		city: "Riyadh",
		district: "Al Nakheel",
		projectType: "villa",
		description: "Private villa package with structural works completed and finishing packages underway.",
		clientId: "usr-client-001",
		designer: "Noura Alotaibi",
		assignedTo: ["usr-emp-001", "usr-emp-002"],
		taskCount: 26,
		startOffsetDays: 180,
		durationDays: 240,
		updatedOffsetDays: 1,
		incompletePlan: ["in_progress", "in_progress", "in_progress", "needs_review"],
	},
	{
		id: "prj-riyadh-002",
		name: "Olaya Palace Annex",
		status: "in_progress",
		city: "Riyadh",
		district: "Al Olaya",
		projectType: "palace",
		description: "Annex development for a palace compound with active MEP and finishing coordination.",
		clientId: "usr-client-002",
		designer: "Maha Alzahrani",
		assignedTo: ["usr-emp-001", "usr-emp-003"],
		taskCount: 22,
		startOffsetDays: 140,
		durationDays: 220,
		updatedOffsetDays: 3,
		incompletePlan: ["in_progress", "in_progress", "not_started"],
	},
	{
		id: "prj-riyadh-003",
		name: "Malqa Executive Villas",
		status: "not_started",
		city: "Riyadh",
		district: "Al Malqa",
		projectType: "villa",
		description: "Upcoming residential villas waiting on procurement release and kickoff scheduling.",
		clientId: "usr-client-003",
		designer: "Rashed Albishi",
		assignedTo: ["usr-emp-002"],
		taskCount: 24,
		startOffsetDays: 60,
		durationDays: 180,
		updatedOffsetDays: 5,
		incompletePlan: ["not_started", "not_started", "not_started"],
	},
	{
		id: "prj-qassim-001",
		name: "Qassim Heritage Palace",
		status: "in_progress",
		city: "Al Qasim",
		district: "City Center",
		projectType: "palace",
		description: "Large palace project with structural closeout and active façade refinement.",
		clientId: "usr-client-004",
		designer: "Hassan Alshehri",
		assignedTo: ["usr-emp-001", "usr-emp-003"],
		taskCount: 18,
		startOffsetDays: 210,
		durationDays: 260,
		updatedOffsetDays: 2,
		incompletePlan: ["in_progress", "in_progress", "needs_review"],
	},
	{
		id: "prj-qassim-002",
		name: "Qassim Modern Villas",
		status: "not_started",
		city: "Al Qasim",
		district: "Al Amal",
		projectType: "villa",
		description: "Design-approved villas queued for site mobilization and initial excavation work.",
		clientId: "usr-client-001",
		designer: "Salem Alotaibi",
		assignedTo: ["usr-emp-002", "usr-emp-003"],
		taskCount: 21,
		startOffsetDays: 30,
		durationDays: 150,
		updatedOffsetDays: 6,
		incompletePlan: ["in_progress"],
	},
	{
		id: "prj-riyadh-004",
		name: "Murabba Residence Cluster",
		status: "completed",
		city: "Riyadh",
		district: "Al Murabba",
		projectType: "villa",
		description: "Completed residential cluster delivered with final snagging already closed.",
		clientId: "usr-client-002",
		designer: "Huda Aljohani",
		assignedTo: ["usr-emp-001", "usr-emp-002", "usr-emp-003"],
		taskCount: 20,
		startOffsetDays: 320,
		durationDays: 200,
		updatedOffsetDays: 8,
		incompletePlan: [],
	},
];

const foundationsTaskNames = [
	"Site survey",
	"Excavation",
	"Blinding concrete",
	"Rebar inspection",
	"Footing pour",
	"Foundation curing",
	"Retaining wall prep",
	"Column starter casting",
	"Ground beam reinforcement",
	"Slab preparation",
];

const finishesTaskNames = [
	"Block work",
	"Wall plaster",
	"Electrical rough-in",
	"Ceiling framing",
	"Lighting fixtures",
	"Floor tiling",
	"Paint first coat",
	"Joinery installation",
	"Sanitary fixtures",
	"Final touch-up",
];

const mockProjects: MockProject[] = projectSeeds.map((seed) => {
	const startDate = daysAgo(seed.startOffsetDays);
	return {
		id: seed.id,
		name: seed.name,
		status: seed.status,
		city: seed.city,
		district: seed.district,
		projectType: seed.projectType,
		description: seed.description,
		clientId: seed.clientId,
		designer: seed.designer,
		assignedTo: seed.assignedTo,
		startDate,
		endDate: daysAfter(startDate, seed.durationDays),
		createdAt: startDate,
		updatedAt: daysAgo(seed.updatedOffsetDays),
	};
});

const mockTasks: MockTask[] = projectSeeds.flatMap((seed) => {
	const project = mockProjects.find((item) => item.id === seed.id)!;
	const completedCount = seed.taskCount - seed.incompletePlan.length;

	return Array.from({ length: seed.taskCount }, (_, index) => {
		const isFoundations = index % 2 === 0;
		const names = isFoundations ? foundationsTaskNames : finishesTaskNames;
		const type: TaskType = isFoundations ? "foundations" : "finishes";
		const name = `${names[index % names.length]} ${Math.floor(index / names.length) + 1}`;
		const startDate = daysAfter(project.startDate, index * 2);
		const endDate = daysAfter(startDate, 4 + (index % 4));
		const status =
			index < completedCount
				? "completed"
				: seed.incompletePlan[index - completedCount];
		const updatedAt =
			status === "completed"
				? daysAfter(endDate, 1)
				: daysAgo((index % 6) + 1);

		return {
			id: `tsk-${seed.id}-${String(index + 1).padStart(3, "0")}`,
			projectId: seed.id,
			name,
			status,
			type,
			startDate,
			endDate,
			createdAt: startDate,
			updatedAt,
			notes: `${name} package scheduled for ${project.name}.`,
		};
	});
});

const highlightedTaskIds = [
	"tsk-prj-riyadh-001-025",
	"tsk-prj-riyadh-002-021",
	"tsk-prj-qassim-001-017",
	"tsk-prj-riyadh-004-020",
];

const mockTaskImages: MockTaskImage[] = highlightedTaskIds.map((taskId, index) => ({
	id: `img-${index + 1}`,
	taskId,
	url: "/Craft_Logo.svg",
	description: "Site progress snapshot",
	uploadedAt: daysAgo(index + 1),
}));

const mockContractsByProjectId: Record<string, Array<{
	id: string;
	contractorName: string;
	contractedAmount: string;
	description: string;
	fileUrl: string | null;
	createdAt: Date;
	updatedAt: Date;
}>> = {
	"prj-riyadh-001": [
		{
			id: "ctr-prj-riyadh-001-01",
			contractorName: "Al Rabwa Contracting",
			contractedAmount: "820000.00",
			description: "Structural and waterproofing package",
			fileUrl: null,
			createdAt: daysAgo(170),
			updatedAt: daysAgo(18),
		},
	],
	"prj-qassim-001": [
		{
			id: "ctr-prj-qassim-001-01",
			contractorName: "Najd Build Co.",
			contractedAmount: "1240000.00",
			description: "Stone façade and external works",
			fileUrl: null,
			createdAt: daysAgo(200),
			updatedAt: daysAgo(11),
		},
	],
};

const getUserById = (userId: string) => mockUsers.find((user) => user.id === userId) || null;

const getTaskImagesByTaskId = (taskId: string) =>
	mockTaskImages.filter((image) => image.taskId === taskId);

export const getMockProjectsResponse = (user?: { id?: string; role?: string } | null) =>
	mockProjects
		.filter((project) => {
			if (!user?.role || user.role === "admin" || user.role === "moderator" || user.role === "employee") {
				return true;
			}

			if (user.role === "client") {
				return project.clientId === user.id;
			}

			return false;
		})
		.map((project) => ({
		id: project.id,
		name: project.name,
		status: project.status,
		city: project.city,
		district: project.district,
		projectType: project.projectType,
		startDate: project.startDate,
		endDate: project.endDate,
		description: project.description,
		designer: project.designer,
		assignedTo: project.assignedTo,
		employees: project.assignedTo
			.map(getUserById)
			.filter((user): user is MockUser => !!user),
		client: getUserById(project.clientId),
	}));

export const getMockTasksResponse = (projectId: string) =>
	mockTasks
		.filter((task) => task.projectId === projectId)
		.map((task) => ({
			taskId: task.id,
			taskName: task.name,
			taskStatus: task.status,
			taskType: task.type,
			startDate: task.startDate,
			endDate: task.endDate,
			updatedAt: task.updatedAt,
			createdAt: task.createdAt,
			notes: task.notes,
			images: getTaskImagesByTaskId(task.id).map((image) => ({
				taskId: image.taskId,
				url: image.url,
				description: image.description,
			})),
		}));

export const getMockProjectById = (projectId: string) => {
	const project = mockProjects.find((item) => item.id === projectId);
	if (!project) return null;

	const client = getUserById(project.clientId);
	return {
		id: project.id,
		name: project.name,
		status: project.status,
		city: project.city,
		district: project.district,
		projectType: project.projectType,
		startDate: project.startDate,
		endDate: project.endDate,
		description: project.description,
		clientId: project.clientId,
		designer: project.designer,
		assignedTo: project.assignedTo,
		employees: project.assignedTo
			.map(getUserById)
			.filter((user): user is MockUser => !!user),
		client,
		tasks: getMockTasksResponse(project.id),
		contracts: mockContractsByProjectId[project.id] || [],
	};
};

export const getMockTaskDetails = (projectId: string, taskId: string) => {
	const task = mockTasks.find((item) => item.projectId === projectId && item.id === taskId);
	if (!task) return null;

	return {
		id: task.id,
		projectId: task.projectId,
		name: task.name,
		status: task.status,
		type: task.type,
		startDate: task.startDate,
		endDate: task.endDate,
		createdAt: task.createdAt,
		updatedAt: task.updatedAt,
		notes: task.notes,
		images: getTaskImagesByTaskId(task.id).map((image) => ({
			id: image.id,
			url: image.url,
			description: image.description,
			uploadedAt: image.uploadedAt,
		})),
	};
};

export const updateMockTaskDetails = (
	projectId: string,
	taskId: string,
	updates: Partial<Pick<MockTask, "name" | "status" | "type" | "startDate" | "endDate" | "notes">>
) => {
	const task = mockTasks.find((item) => item.projectId === projectId && item.id === taskId);
	if (!task) return null;

	if (updates.name !== undefined) task.name = updates.name;
	if (updates.status !== undefined) task.status = updates.status;
	if (updates.type !== undefined) task.type = updates.type;
	if (updates.startDate !== undefined && updates.startDate !== null) task.startDate = updates.startDate;
	if (updates.endDate !== undefined && updates.endDate !== null) task.endDate = updates.endDate;
	if (updates.notes !== undefined) task.notes = updates.notes;

	task.updatedAt = new Date();

	return getMockTaskDetails(projectId, taskId);
};

export const getMockProjectActivity = (projectId: string) =>
	mockTasks
		.filter((task) => task.projectId === projectId)
		.map((task) => {
			const latestImageUpload = getTaskImagesByTaskId(task.id)
				.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0]?.uploadedAt || null;

			return {
				taskId: task.id,
				taskName: task.name,
				createdAt: task.createdAt,
				updatedAt: task.updatedAt,
				latestImageUpload,
			};
		})
		.sort((a, b) => {
			const aLatest = Math.max(
				new Date(a.createdAt).getTime(),
				new Date(a.updatedAt).getTime(),
				a.latestImageUpload ? new Date(a.latestImageUpload).getTime() : 0
			);
			const bLatest = Math.max(
				new Date(b.createdAt).getTime(),
				new Date(b.updatedAt).getTime(),
				b.latestImageUpload ? new Date(b.latestImageUpload).getTime() : 0
			);

			return bLatest - aLatest;
		})
		.slice(0, 5);

export const getMockDashboardData = () => {
	const totalProjectsCount = mockProjects.length;
	const totalUsersCount = mockUsers.length;
	const totalTasksCount = mockTasks.length;

	const countBy = <T extends string>(values: T[]) =>
		values.reduce<Record<string, number>>((acc, value) => {
			acc[value] = (acc[value] || 0) + 1;
			return acc;
		}, {});

	const projectsByStatusMap = countBy(mockProjects.map((project) => project.status));
	const projectsByTypeMap = countBy(mockProjects.map((project) => project.projectType));
	const tasksByStatusMap = countBy(mockTasks.map((task) => task.status));
	const tasksByTypeMap = countBy(mockTasks.map((task) => task.type));
	const usersByRoleMap = countBy(mockUsers.map((user) => user.role));

	const cityMap = mockProjects.reduce<Record<string, { city: string; projects: number; tasks: number }>>(
		(acc, project) => {
			if (!acc[project.city]) {
				acc[project.city] = { city: project.city, projects: 0, tasks: 0 };
			}
			acc[project.city].projects += 1;
			acc[project.city].tasks += mockTasks.filter((task) => task.projectId === project.id).length;
			return acc;
		},
		{}
	);

	const monthlyProgress = Array.from({ length: 6 }, (_, index) => {
		const date = new Date(NOW.getFullYear(), NOW.getMonth() - (5 - index), 1);
		const monthName = date.toLocaleString("en-US", { month: "long" });
		const started = mockProjects.filter(
			(project) =>
				project.createdAt.getMonth() === date.getMonth() &&
				project.createdAt.getFullYear() === date.getFullYear()
		).length;
		const completed = mockProjects.filter(
			(project) =>
				project.status === "completed" &&
				project.updatedAt.getMonth() === date.getMonth() &&
				project.updatedAt.getFullYear() === date.getFullYear()
		).length;

		return {
			month: monthName,
			completed,
			started,
		};
	});

	return {
		overview: {
			totalProjects: totalProjectsCount,
			activeProjects:
				(projectsByStatusMap.in_progress || 0) + (projectsByStatusMap.not_started || 0),
			completedProjects: projectsByStatusMap.completed || 0,
			totalUsers: totalUsersCount,
			adminUsers: usersByRoleMap.admin || 0,
			employeeUsers: (usersByRoleMap.employee || 0) + (usersByRoleMap.moderator || 0),
			clientUsers: usersByRoleMap.client || 0,
		},
		projectsByStatus: Object.entries(projectsByStatusMap).map(([status, count]) => ({
			status,
			count,
			fill: `var(--color-${status})`,
		})),
		projectsByType: Object.entries(projectsByTypeMap).map(([name, count]) => ({
			name: name.charAt(0).toUpperCase() + name.slice(1),
			count,
			percentage: Math.round((count / totalProjectsCount) * 100),
		})),
		cityDistribution: Object.values(cityMap),
		monthlyProgress,
		taskMetrics: {
			totalTasks: totalTasksCount,
			foundationTasks: tasksByTypeMap.foundations || 0,
			finishTasks: tasksByTypeMap.finishes || 0,
			completedTasks: tasksByStatusMap.completed || 0,
			pendingTasks: totalTasksCount - (tasksByStatusMap.completed || 0),
		},
		taskTypes: [
			{ type: "foundation", count: tasksByTypeMap.foundations || 0, fill: "var(--color-foundation)" },
			{ type: "finish", count: tasksByTypeMap.finishes || 0, fill: "var(--color-finish)" },
		],
		recentActivity: [...mockProjects]
			.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
			.slice(0, 3)
			.map((project) => ({
				project: project.name,
				status: project.status,
				city: project.city,
				date: project.updatedAt.toISOString().split("T")[0],
			})),
	};
};

export const getMockSummary = () => ({
	projects: mockProjects.length,
	users: mockUsers.length,
	tasks: mockTasks.length,
	completedTasks: mockTasks.filter((task) => task.status === "completed").length,
	incompleteTasks: mockTasks.filter((task) => task.status !== "completed").length,
});
