'use client'
import { useRouter} from "next/navigation";
import {useEffect} from "react";

const TasksEditPage = () => {
	const router = useRouter();
	useEffect(() => {
		router.back();
	}, []);
};

export default TasksEditPage;