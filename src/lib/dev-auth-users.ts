type DevAuthUser = {
	id: string;
	username: string;
	password: string;
	email: string;
	name: string;
	role: "employee" | "client";
	image: null;
};

const LOCAL_DEV_USERS: DevAuthUser[] = [
	{
		id: "usr-emp-001",
		username: "engineer",
		password: "engineer123",
		email: "engineer@local.dev",
		name: "Local Engineer",
		role: "employee",
		image: null,
	},
	{
		id: "usr-client-001",
		username: "client",
		password: "client123",
		email: "client@local.dev",
		name: "Local Client",
		role: "client",
		image: null,
	},
];

export const getLocalDevAuthUser = (username: string, password: string) =>
	LOCAL_DEV_USERS.find(
		(user) => user.username === username.trim() && user.password === password
	) || null;

export const LOCAL_DEV_LOGIN_ACCOUNTS = LOCAL_DEV_USERS.map(({ password, ...user }) => user);
