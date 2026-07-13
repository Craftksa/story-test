'use client'
import { useRouter} from "next/navigation";
import {useEffect} from "react";

const ContractsEditPage = () => {
	const router = useRouter();
	useEffect(() => {
		router.back();
	}, [router]);
};

export default ContractsEditPage;