'use client'
import { useRouter} from "next/navigation";
import {useEffect} from "react";

const InstallmentsPage = () => {
	const router = useRouter();
	useEffect(() => {
		router.back();
	}, []);
};

export default InstallmentsPage;