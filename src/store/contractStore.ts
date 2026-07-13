import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { toast } from "sonner";
import api from "@/lib/api";

type Contract = {
	id: string;
	projectId: string;
	contractorName: string;
	contractedAmount: string | number;
	description?: string | null;
	fileUrl?: string | null;
	createdAt: string;
	updatedAt: string;
	installments?: { id?: string; installmentAmount: string; paidAmount: string }[];
	[key: string]: unknown;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

type ContractsStore = {
	projectId: string | null;
	setProjectId: (id: string) => void;

	contracts: Contract[];
	selectedContract: Contract | null;
	loading: boolean;
	error: string | null;

	fetchContracts: () => Promise<void>;
	getContractById: (id: string) => Promise<void>;
	fetchOneContract: (id: string) => Promise<void>;
	createContract: (contract: Partial<Contract>) => Promise<Contract | undefined>;
	updateContract: (id: string, contract: Partial<Contract>) => Promise<Contract | undefined>;
	deleteContract: (id: string) => Promise<void>;

	checkDuplicate: (key: string, value: unknown, excludeId?: string) => boolean;
};

export const useContractStore = create<ContractsStore>()(
	devtools((set, get) => ({
		projectId: null,
		setProjectId: (id) => set({ projectId: id }),

		contracts: [],
		selectedContract: null,
		loading: false,
		error: null,

		fetchContracts: async () => {
			const { projectId } = get();
			if (!projectId) return toast.error("Project ID is not set");

			const contractsApi = api.createEntityApi(`/projects/${projectId}/contracts`);
			set({ loading: true, error: null });

			try {
				const contracts = await contractsApi.getAll();
				set({ contracts });
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to fetch contracts");
			} finally {
				set({ loading: false });
			}
		},

		getContractById: async (id) => {
			const { contracts, fetchOneContract } = get();
			if (!contracts || contracts.length === 0) {
				await fetchOneContract(id);
				return;
			}
			const found = contracts.find((contract) => contract.id === id);
			if (found) {
				set({ selectedContract: found });
			} else {
				toast.error("Contract not found");
				set({ selectedContract: null });
			}
		},

		fetchOneContract: async (id) => {
			const { projectId } = get();
			if (!projectId) return toast.error("Project ID is not set");

			const contractsApi = api.createEntityApi(`/projects/${projectId}/contracts`);
			set({ loading: true, error: null });

			try {
				const contract = await contractsApi.getOne(id);
				set({ selectedContract: contract });
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to fetch contract");
			} finally {
				set({ loading: false });
			}
		},

		createContract: async (contract) => {
			const { projectId } = get();
			if (!projectId) return toast.error("Project ID is not set");

			const contractsApi = api.createEntityApi(`/projects/${projectId}/contracts`);
			set({ loading: true, error: null });

			try {
				const newContract = await contractsApi.create(contract);
				const getContract = await contractsApi.getOne(newContract.id);
				set((state) => ({
					contracts: [getContract, ...state.contracts],
				}));
				toast.success("Contract created successfully");
				return getContract;
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to create contract");
			} finally {
				set({ loading: false });
			}
		},

		updateContract: async (id, updatedContract) => {
			const { projectId } = get();
			if (!projectId) return toast.error("Project ID is not set");

			const contractsApi = api.createEntityApi(`/projects/${projectId}/contracts`);
			set({ loading: true, error: null });

			try {
				await contractsApi.update(id, updatedContract);
				const getContract = await contractsApi.getOne(id);
				set((state) => ({
					contracts: state.contracts.map((contract) =>
						contract.id === id ? { ...contract, ...getContract } : contract
					),
				}));
				toast.success("Contract updated successfully");
				return getContract;
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to update contract");
			} finally {
				set({ loading: false });
			}
		},

		deleteContract: async (id) => {
			const { projectId } = get();
			if (!projectId) return toast.error("Project ID is not set");

			const contractsApi = api.createEntityApi(`/projects/${projectId}/contracts`);
			set({ loading: true, error: null });

			try {
				await contractsApi.delete(id);
				set((state) => ({
					contracts: state.contracts.filter((contract) => contract.id !== id),
				}));
				toast.success("Contract deleted successfully");
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to delete contract");
			} finally {
				set({ loading: false });
			}
		},

		checkDuplicate: (key, value, excludeId) => {
			const contracts = get().contracts;
			return contracts.some((contract) => {
				if (excludeId && contract.id === excludeId) return false;
				return contract[key] === value;
			});
		},
	}))
);
