"use client";
import Link from "next/link";

export default function Home() {
  return (
    <div className="home-wrapper">

      <div className="welcome-box">
        
        <div className="home-logo-wrap">
          <h1 className="home-title1">com</h1>
          <h2 className="home-title2">u</h2>
          <h3 className="home-title3">farm</h3>
        </div>

        <p className="home-desc">기업과 농가를 연결하는 커뮤니티</p>

        <div className="home-select">
          <Link href="/company">
            <button className="select-btn select-company">기업으로 접속</button>
          </Link>

          <Link href="/farmer">
            <button className="select-btn select-farmer">농가로 접속</button>
          </Link>
        </div>
      </div>

    </div>
  );
}
