import { NavLink } from "react-router-dom";

export default function Navbar() {
    return (
        <nav>
            <strong>SpendLog</strong>
            <NavLink to="/home">Home</NavLink>
            <NavLink to="/expenses">Expenses</NavLink>
        </nav>
    );
}