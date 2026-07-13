import axios from "axios";

const BASE_URL = "/api";

const api = {
	get: async (path: string, params = {}) => {
		const response = await axios.get(`${BASE_URL}/${path}`, { params });
		return response.data;
	},

	post: async (path: string, data = {}) => {
		const response = await axios.post(`${BASE_URL}/${path}`, data);
		return response.data;
	},

	put: async (path: string, data = {}) => {
		const response = await axios.put(`${BASE_URL}/${path}`, data);
		return response.data;
	},

	delete: async (path: string) => {
		const response = await axios.delete(`${BASE_URL}/${path}`);
		return response.data;
	},

	createEntityApi: (entityName: string) => ({
		getAll: () => api.get(entityName),
		getOne: (id: string) => api.get(`${entityName}/${id}`),
		create: (data: Record<string, unknown> | undefined) => api.post(entityName, data),
		update: (id: string, data: Record<string, unknown> | undefined) =>
			api.put(`${entityName}/${id}`, data),
		delete: (id: string) => api.delete(`${entityName}/${id}`),
	}),
};

export default api;