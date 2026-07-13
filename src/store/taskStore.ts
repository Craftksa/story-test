import {create} from "zustand";
import {devtools} from "zustand/middleware";
import {toast} from "sonner";
import api from "@/lib/api";

type TaskImage = {
	id: string;
	url: string;
	description?: string | null;
	uploadedAt: string;
};

type Task = {
	id: string;
	name: string;
	status: string;
	type: string;
	startDate: string | null;
	endDate: string | null;
	notes?: string | null;
	projectId: string;
	createdAt: string;
	updatedAt: string;
	images: TaskImage[];
	dependsOnTaskId?: string | null;
	isMilestone?: boolean;
	blockedReason?: "client_approval" | "client_documents" | "internal" | "external" | null;
	blockedNote?: string | null;
	blockedAt?: string | null;
	[key: string]: unknown;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

type TasksStore = {
	projectId: string | null;
	setProjectId: (id: string) => void;

	tasks: Task[];
	selectedTask: Task | null;
	loading: boolean;
	error: string | null;

	fetchTasks: () => Promise<void>;
	getTaskById: (id: string) => Promise<void>;
	fetchOneTask: (id: string) => Promise<void>;
	createTask: (task: Partial<Task>) => Promise<Task | undefined>;
	updateTask: (id: string, task: Partial<Task>) => Promise<Task | undefined>;
	deleteTask: (id: string) => Promise<void>;

	checkDuplicate: (key: string, value: unknown, excludeId?: string) => boolean;
	removeImageFromTask: (imageId: string) => Promise<void>;
};

export const useTaskStore = create<TasksStore>()(
	devtools((set, get) => ({
		projectId: null,
		setProjectId: (id) => set({ projectId: id }),

		tasks: [],
		selectedTask: null,
		loading: false,
		error: null,

		fetchTasks: async () => {
			const { projectId } = get();
			if (!projectId) return toast.error("Project ID is not set");

			const tasksApi = api.createEntityApi(`/projects/${projectId}/tasks`);
			set({ loading: true, error: null });

			try {
				const tasks = await tasksApi.getAll();
				set({ tasks });
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to fetch tasks");
			} finally {
				set({ loading: false });
			}
		},

		getTaskById: async (id) => {
			const { tasks, fetchOneTask } = get();
			if (!tasks || tasks.length === 0) {
				await fetchOneTask(id);
				return;
			}
			const foundTask = tasks.find((task) => task.id === id);
			if (foundTask) {
				set({ selectedTask: foundTask });
			} else {
				toast.error("Task not found");
				set({ selectedTask: null });
			}
		},

		fetchOneTask: async (id) => {
			const { projectId } = get();
			if (!projectId) return toast.error("Project ID is not set");

			const tasksApi = api.createEntityApi(`/projects/${projectId}/tasks`);
			set({ loading: true, error: null });

			try {
				const task = await tasksApi.getOne(id);
				set({ selectedTask: task });
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to fetch task");
			} finally {
				set({ loading: false });
			}
		},

		createTask: async (task) => {
			const { projectId } = get();
			if (!projectId) return toast.error("Project ID is not set");

			const tasksApi = api.createEntityApi(`/projects/${projectId}/tasks`);
			set({ loading: true, error: null });

			try {
				const newTask = await tasksApi.create(task);
				const getTask = await tasksApi.getOne(newTask.id);
				set((state) => ({
					tasks: [getTask, ...state.tasks],
				}));
				toast.success("Task created successfully");
				return getTask;
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to create task");
			} finally {
				set({ loading: false });
			}
		},

		updateTask: async (id, updatedTask) => {
			const { projectId } = get();
			if (!projectId) return toast.error("Project ID is not set");

			const tasksApi = api.createEntityApi(`/projects/${projectId}/tasks`);
			set({ loading: true, error: null });

			try {
				await tasksApi.update(id, updatedTask);
				const getTask = await tasksApi.getOne(id);
				set((state) => ({
					tasks: state.tasks.map((task) =>
						task.id === id ? { ...task, ...getTask } : task
					),
				}));
				toast.success("Task updated successfully");
				return getTask;
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to update task");
			} finally {
				set({ loading: false });
			}
		},

		deleteTask: async (id) => {
			const { projectId } = get();
			if (!projectId) return toast.error("Project ID is not set");

			const tasksApi = api.createEntityApi(`/projects/${projectId}/tasks`);
			set({ loading: true, error: null });

			try {
				await tasksApi.delete(id);
				set((state) => ({
					tasks: state.tasks.filter((task) => task.id !== id),
				}));
				toast.success("Task deleted successfully");
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to delete task");
			} finally {
				set({ loading: false });
			}
		},

		checkDuplicate: (key, value, excludeId) => {
			const tasks = get().tasks;
			return tasks.some((task) => {
				if (excludeId && task.id === excludeId) return false;
				return task[key] === value;
			});
		},
		removeImageFromTask: (imageId: string) =>
			set((state) => {
				if (!state.selectedTask) return {};

				return {
					selectedTask: {
						...state.selectedTask,
						images: state.selectedTask.images.filter(
							(image) => image.id !== imageId
						),
					},
				};
			})
	}))
);
