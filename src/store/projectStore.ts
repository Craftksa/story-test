import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { toast } from "sonner";
import api from "@/lib/api";
import {ParamValue} from "next/dist/server/request/params";

type Project = {
	id: string;
	name: string;
	tasks?: { taskId: string; [key: string]: unknown }[];
	contracts?: { id: string; [key: string]: unknown }[];
	employees?: { id: string; name?: string | null; email?: string | null; role?: string | null; image?: string | null }[];
	[key: string]: unknown;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

type ProjectsStore = {
	projects: Project[];
	selectedProject: Project | null;
	loading: boolean;
	error: string | null;

	fetchProjects: () => Promise<void>;
	getProjectById: (id: string) => Promise<void>;
	fetchOneProject: (id: ParamValue) => Promise<void>;
	createProject: (project: Partial<Project>) => Promise<void>;
	updateProject: (id: string, project: Partial<Project>) => Promise<void>;
	deleteProject: (id: string) => Promise<void>;

	checkDuplicate: (key: string, value: unknown, excludeId?: string) => boolean;
	removeTaskFromProject: (taskId: string) => void
	removeContractFromProject: (contractId: string) => void
};

const projectsApi = api.createEntityApi("projects");

export const useProjectStore = create<ProjectsStore>()(
	devtools((set, get) => ({
		projects: [],
		selectedProject: null,
		loading: false,
		error: null,

		fetchProjects: async () => {
			const { projects } = get();
			set({ loading: true, error: null });
			try {
				if (!projects || projects.length === 0) {
					const projects = await projectsApi.getAll();
					set({ projects });
				}
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to fetch projects");
			} finally {
				set({ loading: false });
			}
		},
		getProjectById: async (id) => {
			const { projects, fetchOneProject } = get();

			if (!projects || projects.length === 0) {
				// Fetch the project from the API and set it as selected
				await fetchOneProject(id);
				return;
			}

			// Find the project from the local projects array
			const foundProject = projects.find((project) => project.id === id);

			if (foundProject) {
				set({ selectedProject: foundProject });
			} else {
				toast.error("Project not found");
				set({ selectedProject: null });
			}
		},
		fetchOneProject: async (id) => {
			set({ loading: true, error: null });
			try {
				const project = await projectsApi.getOne(id as string);
				set({ selectedProject: project });
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to fetch project");
			} finally {
				set({ loading: false });
			}
		},
		createProject: async (project) => {
			set({ loading: true, error: null });
			try {
				const newProject = await projectsApi.create(project);
				const getProject = await projectsApi.getOne(newProject.id);

				set((state) => ({
					projects: [getProject, ...state.projects],
				}));
				toast.success("Project created successfully");
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to create project");
			} finally {
				set({ loading: false });
			}
		},

		updateProject: async (id, updatedProject) => {
			set({ loading: true, error: null });
			try {
				await projectsApi.update(id, updatedProject);
				const getProject = await projectsApi.getOne(id);

				set((state) => ({
					projects: state.projects.map((project) =>
						project.id === id ? { ...project, ...getProject } : project
					),
				}));
				toast.success("Project updated successfully");
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to update project");
			} finally {
				set({ loading: false });
			}
		},

		deleteProject: async (id) => {
			set({ loading: true, error: null });
			try {
				await projectsApi.delete(id);
				set((state) => ({
					projects: state.projects.filter((project) => project.id !== id),
				}));
				toast.success("Project deleted successfully");
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to delete project");
			} finally {
				set({ loading: false });
			}
		},

		checkDuplicate: (key: string, value: unknown, excludeId?: string) => {
			const projects = get().projects;
			return projects.some((project) => {
				if (excludeId && project.id === excludeId) return false;
				return project[key] === value;
			});
		},

		removeTaskFromProject: (taskId: string) =>
			set((state) => {
				if (!state.selectedProject) return {};

				return {
					selectedProject: {
						...state.selectedProject,
						tasks: state.selectedProject.tasks?.filter(
							(task) => task.taskId !== taskId
						),
					},
				};
			}),
		removeContractFromProject: (contractId: string) =>
			set((state) => {
				if (!state.selectedProject) return {};

				return {
					selectedProject: {
						...state.selectedProject,
						contracts: state.selectedProject.contracts?.filter(
							(contract) => contract.id !== contractId
						),
					},
				};
			}),


	}))
);
