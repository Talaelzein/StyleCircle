import { Link } from "react-router-dom";
import { illustrationUrl } from "../../data/categories.js";

export default function CategoryCard({ category, count, compact = false, headingLevel = 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Link className={`category-card ${compact ? "category-card--compact" : ""}`}
      to={`/wardrobe/${category.key}`}
    >
      <div className="category-card__art">
        <img src={illustrationUrl(category.art)} alt="" loading="lazy" />
      </div>
      <div className="category-card__footer">
        <div>
          <Heading>{category.label}</Heading>
          <p>{Number.isFinite(count) ? `${count} piece${count === 1 ? "" : "s"}` : category.hint}</p>
        </div>
        <span className="round-arrow" aria-hidden="true">→</span>
      </div>
    </Link>
  );
}
