export default function Logo({ mode }) {
  return (
    <div className="logo">
      {mode === "company" && <h1>comufarm for company</h1>}
      {mode === "farmer" && <h1>comufarm for farmer</h1>}
      {mode === "neutral" && <h1>comufarm</h1>}
    </div>
  );
}
