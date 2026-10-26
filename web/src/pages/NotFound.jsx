import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container page">
      <h1>Page not found</h1>
      <p className="muted">That page took a wrong turn.</p>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </div>
  );
}
