import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "./Loader";
export default function ProtectedRoute
({
roles,children
}) {
    const {user,loading}=useAuth();
    const location=useLocation();
    if(loading){
        return <Loader text="Checking your session..."/>;
    }
    if(!user){
        return (
            <Navigate to="/login" replace state={{from: location}}/>
        );
    }
    const userRole=user.role?.toUpperCase();
    const allowedRole=roles?.map(role=>role.toUpperCase());
    if(allowedRole && !allowedRole.includes(userRole)){
        return <Navigate to="/unauthorized" replace/>;
}
    return children;
}
