import React from 'react'
import { Container, Row, Col } from 'react-bootstrap'
import { Outlet } from 'react-router-dom'
import Accountaside from './Accountaside'

const Myaccount = () => {
  return (
    <section className='myaccount_sec py-4'>
        <Container>
              <Row> 
                  <Col lg={3} md={4}  sm={12}>
                     <div className="myacsidebar bg-white px-3 py-2 rounded">
                           <Accountaside/>  
                     </div>
                  </Col>

                  <Col lg={9} md={8}  sm={12}>
                      <div className="account_content">
                           <Outlet/> 
                      </div>
                  </Col>
              </Row>
        </Container>
    </section>
  )
}

export default Myaccount