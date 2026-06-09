import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";

export default function Loader() {
  const auth = useSelector((s) => s.auth);
  const cart = useSelector((s) => s.cart);
  const category = useSelector((s) => s.categories);
  const order = useSelector((s) => s.order);
  const products = useSelector((s) => s.products);
  const address = useSelector((s) => s.address);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // setShow(
    //   auth.isLoading ||
    //   category.categories.isLoading ||
    //   category.topCategories.isLoading ||
    //   category.sourceByApplication.isLoading ||
    //   order.orders.isLoading ||
    //   order.placingOrder ||
    //   address.addresses.isLoading ||
    //   address.addressDetail.isLoading ||
    //   products.products.isLoading ||
    //   products.topRankingProducts.isLoading ||
    //   products.newArrivalProducts.isLoading ||
    //   products.savingSpotlightProducts.isLoading ||
    //   products.guaranteedProducts.isLoading ||
    //   products.bestSalerProducts.isLoading ||
    //   products.productDetail.isLoading
    // );
  }, [auth, category, cart, order, products, address]);

  return (
    <>
      <div
        className="site-loader"
        style={{
          display: show ? "flex" : "none",
        }}
      >
        <Spinner animation="border" role="status" size={"lg"}>
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    </>
  );
}
