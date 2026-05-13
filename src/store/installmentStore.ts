// stores/installmentStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { toast } from "sonner";
import api from "@/lib/api";

type Installment = {
	id: string;
	installmentNo: number;
	installmentAmount: string;
	paidAmount: string;
	paymentDate: string | null;
	taskId: string | null;
	createdAt: string;
	updatedAt: string;
};

type InstallmentsStore = {
	projectId: string | null;
	contractId: string | null;
	setProjectId: (id: string) => void;
	setContractId: (id: string) => void;

	installments: Installment[];
	selectedInstallment: Installment | null;
	loading: boolean;
	error: string | null;

	fetchInstallments: () => Promise<void>;
	getInstallmentById: (id: string) => Promise<void>;
	fetchOneInstallment: (id: string) => Promise<void>;
	createInstallment: (data: any) => Promise<Installment | void>;
	updateInstallment: (id: string, data: any) => Promise<Installment | void>;
	deleteInstallment: (id: string) => Promise<void>;
};

export const useInstallmentStore = create<InstallmentsStore>()(
	devtools((set, get) => ({
		projectId: null,
		contractId: null,
		setProjectId: (id) => set({ projectId: id }),
		setContractId: (id) => set({ contractId: id }),

		installments: [],
		selectedInstallment: null,
		loading: false,
		error: null,

		fetchInstallments: async () => {
			const { projectId, contractId } = get();
			if (!projectId || !contractId) return toast.error("Project or Contract ID is not set");

			const installmentsApi = api.createEntityApi(
				`/projects/${projectId}/contracts/${contractId}/installments`
			);
			set({ loading: true, error: null });

			try {
				const installments = await installmentsApi.getAll();
				set({ installments });
			} catch (error: any) {
				set({ error: error.message });
				toast.error("Failed to fetch installments");
			} finally {
				set({ loading: false });
			}
		},

		getInstallmentById: async (id) => {
			const { installments, fetchOneInstallment } = get();
			if (!installments.length) {
				await fetchOneInstallment(id);
				return;
			}
			const found = installments.find((i) => i.id === id);
			if (found) {
				set({ selectedInstallment: found });
			} else {
				toast.error("Installment not found");
				set({ selectedInstallment: null });
			}
		},

		fetchOneInstallment: async (id) => {
			const { projectId, contractId } = get();
			if (!projectId || !contractId) return toast.error("Project or Contract ID is not set");

			const installmentsApi = api.createEntityApi(
				`/projects/${projectId}/contracts/${contractId}/installments`
			);
			set({ loading: true, error: null });

			try {
				const installment = await installmentsApi.getOne(id);
				set({ selectedInstallment: installment });
			} catch (error: any) {
				set({ error: error.message });
				toast.error("Failed to fetch installment");
			} finally {
				set({ loading: false });
			}
		},

		createInstallment: async (data) => {
			const { projectId, contractId } = get();
			if (!projectId || !contractId) return toast.error("Project or Contract ID is not set");

			const installmentsApi = api.createEntityApi(
				`/projects/${projectId}/contracts/${contractId}/installments`
			);
			set({ loading: true, error: null });

			try {
				const newInstallment = await installmentsApi.create(data);
				const fullInstallment = await installmentsApi.getOne(newInstallment.id);
				set((state) => ({
					installments: [fullInstallment, ...state.installments],
				}));
				toast.success("Installment created successfully");
				return fullInstallment;
			} catch (error: any) {
				set({ error: error.message });
				toast.error("Failed to create installment");
			} finally {
				set({ loading: false });
			}
		},

		updateInstallment: async (id, data) => {
			const { projectId, contractId } = get();
			if (!projectId || !contractId) return toast.error("Project or Contract ID is not set");

			const installmentsApi = api.createEntityApi(
				`/projects/${projectId}/contracts/${contractId}/installments`
			);
			set({ loading: true, error: null });

			try {
				await installmentsApi.update(id, data);
				const updated = await installmentsApi.getOne(id);
				set((state) => ({
					installments: state.installments.map((i) =>
						i.id === id ? { ...i, ...updated } : i
					),
				}));
				toast.success("Installment updated successfully");
				return updated;
			} catch (error: any) {
				set({ error: error.message });
				toast.error("Failed to update installment");
			} finally {
				set({ loading: false });
			}
		},

		deleteInstallment: async (id) => {
			const { projectId, contractId } = get();
			if (!projectId || !contractId) return toast.error("Project or Contract ID is not set");

			const installmentsApi = api.createEntityApi(
				`/projects/${projectId}/contracts/${contractId}/installments`
			);
			set({ loading: true, error: null });

			try {
				await installmentsApi.delete(id);
				set((state) => ({
					installments: state.installments.filter((i) => i.id !== id),
				}));
				toast.success("Installment deleted successfully");
			} catch (error: any) {
				set({ error: error.message });
				toast.error("Failed to delete installment");
			} finally {
				set({ loading: false });
			}
		},
	}))
);
