import { useDispatch } from "react-redux";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { onChangeVariation } from "../../helpers/cartHelper";
import { formatNumber, logger } from "../../helpers/commonHelper";

export function ProductVariations({ detail, setShow, handlerAddToCart }) {
  const dispatch = useDispatch();

  logger('attributes', detail.attributes);
  logger('variations', detail.variations);

  return (
    <>
      <div className="variants">
        <div className="variants_title">
          <h6>Variations</h6>
        </div>

        <div className="total_variation d-flex align-items-center gap-2">
          <p className="w-75 text-truncate">
            Total options:{" "}
            {detail?.attributes?.map(
              (attribute) => `${formatNumber(attribute?.terms?.length)} ${attribute.name}; `
            )}
          </p>
        </div>

        <ul className="p-0">
          {detail?.attributes?.map((attribute, index) => {
            return (
              <li key={index}>
                <div className="divone my-3">
                  <p className="m-0">
                    <strong>
                      {index + 1}. {attribute.name}({formatNumber(attribute?.terms?.length)}):
                    </strong>{" "}
                    {attribute.terms?.map((term, idx) => {
                      if (term?.active) return term.name;
                      return null;
                    })}
                  </p>

                  <div className="six_color d-flex flex-wrap align-items-center gap-1">
                    {attribute.terms?.map((term, idx) => {
                      return (
                        <div
                          className="six_color d-flex align-items-center gap-1 cursor-pointer"
                          key={idx}
                        >
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id={`tooltip-${idx}`}>{term.name}</Tooltip>}
                          >
                            <div
                              className={
                                "ram_col d-flex align-items-center justify-content-center px-2 " +
                                (term?.active ? "active" : "")
                              }
                              onClick={() => {
                                onChangeVariation({
                                  dispatch,
                                  detail,
                                  termIndex: idx,
                                  attributeIndex: index,
                                });
                              }}
                            >
                              <p className="m-0 text-truncate">{term.name}</p>
                            </div>
                          </OverlayTrigger>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

    </>
  );
}
