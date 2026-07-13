'use client'
import { useRouter} from "next/navigation";
import {useEffect} from "react";

const TasksUploadPage = () => {
	const router = useRouter();
	useEffect(() => {
		router.back();
	}, [router]);
};

export default TasksUploadPage;