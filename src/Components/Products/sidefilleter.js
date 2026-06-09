import React from "react";
import { Accordion } from "react-bootstrap";
import { FormGroup, Label, Input } from "reactstrap";

const Sidefilleter = () => {
  return (
    <section className="filter_set">
      <h5 className="fillter_head text-start mb-4">Fillter By:</h5>

      <div className="fillter_accordiion">
        <Accordion defaultActiveKey="0">
          <Accordion.Item eventKey="0">
            <Accordion.Header>Price Low</Accordion.Header>
            <Accordion.Body>
              <FormGroup check>
                <Label check>
                  <Input type="checkbox" />
                  Lorem, ipsum dolor.
                </Label>
              </FormGroup>

              <FormGroup check>
                <Label check>
                  <Input type="checkbox" />
                  Lorem, ipsum dolor.
                </Label>
              </FormGroup>

              <FormGroup check>
                <Label check>
                  <Input type="checkbox" />
                  Lorem, ipsum dolor.
                </Label>
              </FormGroup>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>Price High</Accordion.Header>
            <Accordion.Body>

            <FormGroup check>
          <Label check>
            <Input type="checkbox" />
             Lorem, ipsum dolor.
          </Label>
        </FormGroup>

        <FormGroup check>
          <Label check>
            <Input type="checkbox" />
             Lorem, ipsum dolor.
          </Label>
        </FormGroup>


        <FormGroup check>
          <Label check>
            <Input type="checkbox" />
             Lorem, ipsum dolor.
          </Label>
        </FormGroup>
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="2">
            <Accordion.Header>Price Low to High</Accordion.Header>
            <Accordion.Body>
            <FormGroup check>
          <Label check>
            <Input type="checkbox" />
             Lorem, ipsum dolor.
          </Label>
        </FormGroup>

        <FormGroup check>
          <Label check>
            <Input type="checkbox" />
             Lorem, ipsum dolor.
          </Label>
        </FormGroup>


        <FormGroup check>
          <Label check>
            <Input type="checkbox" />
             Lorem, ipsum dolor.
          </Label>
        </FormGroup>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </div>
    </section>
  );
};

export default Sidefilleter;
