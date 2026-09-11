import React, { useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { clearAuthSession, getAuthSession } from "../api/eloquentApi";
import webLogo from "../otherImages/logo-icon.png";
import webSideLogo from "../otherImages/logo.svg";
import profilePic from "../otherImages/profilePic.png";

const menuItems = [
  {
    icon: "solar:gallery-outline",
    label: "Gallery",
    path: "/gallery",
  },
  {
    icon: "solar:folder-with-files-outline",
    label: "Categories",
    path: "/categories",
  },
  {
    icon: "solar:stars-minimalistic-outline",
    label: "What's New",
    path: "/whats-new",
  },
  {
    icon: "solar:home-smile-angle-outline",
    label: "Home Categories",
    path: "/home-categories",
  },
  
  {
    icon: "solar:document-text-outline",
    label: "Blogs",
    path: "/blogs",
  },

  {
    icon: "solar:users-group-rounded-outline",
    label: "All Users",
    path: "/all-users",
  },

  {
    icon: "solar:bag-check-outline",
    label: "Printful Orders",
    path: "/printful-orders",
  },

  {
    icon: "solar:letter-outline",
    label: "Contact Submissions",
    path: "/contact-form",
  },
];

const MasterLayout = ({ children }) => {
  const [sidebarActive, setSidebarActive] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const navigate = useNavigate();
  const user = getAuthSession()?.user || {};

  const sidebarControl = () => setSidebarActive(!sidebarActive);
  const mobileMenuControl = () => setMobileMenu(!mobileMenu);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/");
  };

  return (
    <section className={mobileMenu ? "overlay active" : "overlay "}>
      <aside
        className={
          sidebarActive
            ? "sidebar active "
            : mobileMenu
            ? "sidebar sidebar-open"
            : "sidebar"
        }
      >
        <button
          onClick={mobileMenuControl}
          type='button'
          className='sidebar-close-btn'
        >
          <Icon icon='radix-icons:cross-2' />
        </button>
        <div>
          <Link to='/gallery' className='sidebar-logo eloquent-sidebar-logo'>
            <img src={webLogo} alt='site logo' className='light-logo' />
            <img src={webLogo} alt='site logo' className='dark-logo' />
            <img
              src={webSideLogo}
              alt='site logo'
              className='logo-icon'
              style={{ width: "40px" }}
            />
            <span>Eloquent</span>
          </Link>
        </div>

        <div className='sidebar-menu-area'>
          <ul className='sidebar-menu' id='sidebar-menu'>
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={(navData) => (navData.isActive ? "active-page" : "")}
                >
                  <Icon icon={item.icon} className='menu-icon' width='24' />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="bottomSide">
          <ul>
            <li>
              <button className="eloquent-sidebar-button" onClick={handleLogout} type="button">
                <Icon
                  icon='material-symbols:logout-rounded'
                  className='menu-icon'
                  width='28'
                  height='28'
                />
                <span>Log Out</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>

      <main className={sidebarActive ? "dashboard-main active" : "dashboard-main"}>
        <div className='navbar-header eloquent-navbar'>
          <div className='row align-items-center justify-content-between'>
            <div className='col-auto'>
              <div className='d-flex flex-wrap align-items-center gap-4'>
                <button
                  type='button'
                  className='sidebar-toggle'
                  onClick={sidebarControl}
                >
                  {sidebarActive ? (
                    <Icon icon='iconoir:arrow-right' className='icon text-2xl non-active' />
                  ) : (
                    <Icon icon='heroicons:bars-3-solid' className='icon text-2xl non-active ' />
                  )}
                </button>
                <button
                  onClick={mobileMenuControl}
                  type='button'
                  className='sidebar-mobile-toggle'
                >
                  <Icon icon='heroicons:bars-3-solid' className='icon' />
                </button>
                <div className='eloquent-top-title'>
                  {/* <span>Admin Panel</span> */}
                  <strong>Eloquent Images</strong>
                </div>
              </div>
            </div>
            <div className='col-auto'>
              <div className='d-flex flex-wrap align-items-center gap-3'>
                <div className='dropdown'>
                  <button
                    className='d-flex justify-content-center align-items-center rounded-circle'
                    type='button'
                    data-bs-toggle='dropdown'
                  >
                    <img
                      src={profilePic}
                      alt='image_user'
                      className='w-40-px h-40-px object-fit-cover rounded-circle'
                    />
                  </button>
                  <div className='dropdown-menu to-top dropdown-menu-sm'>
                    <div className='py-12 px-16 radius-8 bg-primary-50 mb-16 d-flex align-items-center justify-content-between gap-2'>
                      <div>
                        <h6 className='text-lg text-primary-light fw-semibold mb-2'>
                          {user.name || "Admin"}
                        </h6>
                        <span className='text-secondary-light fw-medium text-sm'>
                          {user.role || "ADMIN"}
                        </span>
                      </div>
                    </div>
                    <ul className='to-top-list'>
                      <li>
                        <button
                          className='dropdown-item text-black px-0 py-8 hover-bg-transparent hover-text-danger d-flex align-items-center gap-3'
                          onClick={handleLogout}
                          type='button'
                        >
                          <Icon icon='lucide:power' className='icon text-xl' />
                          Log Out
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='dashboard-main-body eloquent-dashboard-body'>{children}</div>
      </main>
    </section>
  );
};

export default MasterLayout;
