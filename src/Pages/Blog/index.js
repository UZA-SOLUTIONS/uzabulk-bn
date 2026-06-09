// src/components/Blog.js
import React from "react";
import { Helmet } from "react-helmet";
import { Container, Row, Col, Breadcrumb, Card, Button } from "react-bootstrap";
import { APP_NAME } from "../../config/constants";
import './Blog.css'; // Import custom CSS for additional styling
import ROUTES from "../../helpers/routesHelper";

// Sample blog posts data
const blogPosts = [
  {
    id: 1,
    title: "Understanding E-Commerce Trends",
    summary: "Explore the latest trends in e-commerce and how they are shaping the future of online shopping.",
    date: "August 6, 2024",
    category: "E-Commerce",
    readTime: "5 min read",
    link: "/blog/understanding-ecommerce-trends",
    image: "https://www.assiduusglobal.com/blog/wp-content/uploads/2022/01/e-commerce-trends.jpeg"
  },
  {
    id: 2,
    title: "Tips for Enhancing Online Customer Experience",
    summary: "Discover strategies to improve the online shopping experience for your customers and boost engagement.",
    date: "July 15, 2024",
    category: "Customer Experience",
    readTime: "4 min read",
    link: "/blog/tips-for-enhancing-customer-experience",
    image: "https://kaizo.com/wp-content/uploads/2022/03/ways-to-improve-customer-experience-1024x449.png"
  },
  {
    id: 3,
    title: "The Importance of Mobile Optimization",
    summary: "Learn why mobile optimization is crucial for your e-commerce site and how to implement it effectively.",
    date: "June 22, 2024",
    category: "Technology",
    readTime: "6 min read",
    link: "/blog/mobile-optimization",
    image: "https://media.licdn.com/dms/image/D5612AQE4LkTjqh0aQw/article-cover_image-shrink_600_2000/0/1677152957467?e=2147483647&v=beta&t=8bDnVir-a0p154x3ktO8XA3CGp1d1yqgU6HhR9sE1bQ"
  }
];

const Blog = () => {
  const featuredPost = blogPosts[0];
  const otherPosts = blogPosts.slice(1);

  return (
    <section className="blog_page blog_editorial_page">
      <Helmet>
        <title>Blog - {APP_NAME}</title>
        <meta name="description" content="Read the latest blog posts on e-commerce trends, customer experience, and more." />
      </Helmet>
      <Container>
        <div className="wrap_conatainer px-lg-4 p-0">

          <Breadcrumb className="my-4">
            <Breadcrumb.Item href={ROUTES.HOME}>Home</Breadcrumb.Item>
            <Breadcrumb.Item active>Blog</Breadcrumb.Item>
          </Breadcrumb>

          <div className="blog_hero">
            <span className="blog_eyebrow">Insights and Guides</span>
            <h1>UZA Bulk Blog</h1>
            <p>
              Practical ideas for smarter sourcing, better online shopping experiences,
              and growing with modern e-commerce trends.
            </p>
          </div>

          <Row className="g-4 align-items-stretch mb-5">
            <Col lg={7}>
              <Card className="blog_featured_card h-100">
                <div className="blog_featured_image">
                  <Card.Img src={featuredPost.image} alt={featuredPost.title} />
                </div>
                <Card.Body>
                  <div className="blog_meta">
                    <span>{featuredPost.category}</span>
                    <span>{featuredPost.date}</span>
                    <span>{featuredPost.readTime}</span>
                  </div>
                  <Card.Title>{featuredPost.title}</Card.Title>
                  <Card.Text>{featuredPost.summary}</Card.Text>
                  <Button href={featuredPost.link} className="blog_read_more disabled">
                    Read Article
                  </Button>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={5}>
              <div className="blog_side_panel h-100">
                <h2>Latest Articles</h2>
                <p>Fresh perspectives to help buyers and sellers make better decisions.</p>
                {otherPosts.map((post) => (
                  <article className="blog_list_item" key={post.id}>
                    <img src={post.image} alt={post.title} />
                    <div>
                      <div className="blog_meta compact">
                        <span>{post.category}</span>
                        <span>{post.readTime}</span>
                      </div>
                      <h3>{post.title}</h3>
                      <small>{post.date}</small>
                    </div>
                  </article>
                ))}
              </div>
            </Col>
          </Row>

          <Row className="g-4 mb-5">
            {blogPosts.map((post) => (
              <Col lg={4} md={6} sm={12} key={post.id}>
                <Card className="blog-card h-100">
                  <div className="blog_card_image">
                    <Card.Img variant="top" src={post.image} alt={post.title} />
                  </div>
                  <Card.Body>
                    <div className="blog_meta">
                      <span>{post.category}</span>
                      <span>{post.readTime}</span>
                    </div>
                    <Card.Title>{post.title}</Card.Title>
                    <Card.Subtitle className="mb-2 text-muted">{post.date}</Card.Subtitle>
                    <Card.Text>{post.summary}</Card.Text>
                    <Button variant="primary" href={post.link} className="blog_read_more disabled">Read More</Button>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </Container>
    </section>
  );
};

export default Blog;
