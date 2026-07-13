import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { toast } from "sonner";
import api from "@/lib/api";

type User = {
	id: string;
	name: string;
	username: string;
	email: string;
	role: string;
	image?: string | null;
	createdAt?: string;
	[key: string]: unknown;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

type UsersStore = {
	users: User[];
	selectedUser: User | null;
	loading: boolean;
	error: string | null;

	fetchUsers: () => Promise<void>;
	getUserById: (id: string) => Promise<void>;
	fetchOneUser: (id: string) => Promise<void>;
	createUser: (user: Partial<User>) => Promise<void>;
	updateUser: (id: string, user: Partial<User>) => Promise<void>;
	deleteUser: (id: string) => Promise<void>;

	checkDuplicate: (key: string, value: unknown, excludeId?: string) => boolean;
};

const usersApi = api.createEntityApi("users");

export const useUserStore = create<UsersStore>()(
	devtools((set, get) => ({
		users: [],
		selectedUser: null,
		loading: false,
		error: null,

		fetchUsers: async () => {
			const { users } = get();
			set({ loading: true, error: null });
			try {
				if (!users || users.length === 0) {
					const users = await usersApi.getAll();
					set({ users });
				}
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to fetch users");
			} finally {
				set({ loading: false });
			}
		},
		getUserById: async (id) => {
			const { users, fetchOneUser } = get();

			if (!users || users.length === 0) {
				// Fetch the user from the API and set it as selected
				await fetchOneUser(id);
				return;
			}

			// Find the user from the local users array
			const foundUser = users.find((user) => user.id === id);

			if (foundUser) {
				set({ selectedUser: foundUser });
			} else {
				toast.error("User not found");
				set({ selectedUser: null });
			}
		},
		fetchOneUser: async (id) => {
			set({ loading: true, error: null });
			try {
				const user = await usersApi.getOne(id);
				set({ selectedUser: user });
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to fetch user");
			} finally {
				set({ loading: false });
			}
		},
		createUser: async (user) => {
			set({ loading: true, error: null });
			try {
				const newUser = await usersApi.create(user);
				const getUser = await usersApi.getOne(newUser.id);

				set((state) => ({
					users: [getUser, ...state.users],
				}));
				toast.success("User created successfully");
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to create user");
			} finally {
				set({ loading: false });
			}
		},

		updateUser: async (id, updatedUser) => {
			set({ loading: true, error: null });
			try {
				await usersApi.update(id, updatedUser);
				const getUser = await usersApi.getOne(id);

				set((state) => ({
					users: state.users.map((user) =>
						user.id === id ? { ...user, ...getUser } : user
					),
				}));
				toast.success("User updated successfully");
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to update user");
			} finally {
				set({ loading: false });
			}
		},

		deleteUser: async (id) => {
			set({ loading: true, error: null });
			try {
				await usersApi.delete(id);
				set((state) => ({
					users: state.users.filter((user) => user.id !== id),
				}));
				toast.success("User deleted successfully");
			} catch (error) {
				set({ error: getErrorMessage(error) });
				toast.error("Failed to delete user");
			} finally {
				set({ loading: false });
			}
		},

		checkDuplicate: (key: string, value: unknown, excludeId?: string) => {
			const users = get().users;
			return users.some((user) => {
				if (excludeId && user.id === excludeId) return false;
				return user[key] === value;
			});
		}
	}))
);
