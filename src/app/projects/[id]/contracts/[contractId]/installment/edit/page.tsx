'use client'
import { useRouter} from "next/navigation";
import {useEffect} from "react";

const InstallmentsEditPage = () => {
	const router = useRouter();
	useEffect(() => {
		router.back();
	}, [router]);
};

export default InstallmentsEditPage;