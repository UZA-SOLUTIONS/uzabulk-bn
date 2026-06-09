import { Provider } from "react-redux";
import { ToastContainer } from "react-toastify";

import "./App.css";
import "./assets/css/style.css";
import "./assets/css/mobile-responsive.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import "react-phone-input-2/lib/style.css";
import "react-toastify/dist/ReactToastify.css";

import Loader from "./Components/Common/Loader";
import PrefetchHomeCategories from "./Components/Common/PrefetchHomeCategories";
import PrefetchHomeRecommended from "./Components/Common/PrefetchHomeRecommended";
import MyRouts from "./Routers/routes";
import { store } from "./store/store";

function App() {
  return (
    <div className="App">
      <Provider store={store}>
        <PrefetchHomeCategories />
        <PrefetchHomeRecommended />
        <MyRouts />
        <ToastContainer />
        <Loader />
      </Provider>
      
    </div>
  );
}

export default App;
