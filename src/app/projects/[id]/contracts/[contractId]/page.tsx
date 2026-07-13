'use client';

import React, {useEffect} from 'react';
import {useParams} from "next/navigation";
import ContractDetailsCard from "@/components/ContractDetailsCard";
import {useContractStore} from "@/store/contractStore";
import Spinner from "@/components/Spinner";
import {useSession} from "next-auth/react";
import {useTranslations} from "use-intl";

const Page = () => {
	const {id: projectId, contractId} = useParams();
	const {selectedContract, fetchOneContract, setProjectId, loading, deleteContract} = useContractStore();
	const { data: session } = useSession();
	const user = session?.user;
	const t = useTranslations();

	useEffect(() => {
		setProjectId(projectId as string)
		fetchOneContract(contractId as string)
	}, [projectId, contractId, setProjectId, fetchOneContract])

	if (!selectedContract || loading) {
		return (
			<div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
				<Spinner className="h-6 w-6 text-muted-foreground" />
				<span className="mx-2 text-muted-foreground">{t("Loading contract")}...</span>
			</div>
		)
	}

	return (
		<div>
			<ContractDetailsCard contract={selectedContract} deleteContract={deleteContract} user={user} />
		</div>
	);
};

export default Page;